import { X509Certificate, createPrivateKey } from 'crypto';
import { CertificateRejection } from '@core/enums/certificate-rejection.enum';
import { CertificateValidationError } from '@core/certificates/certificate-validation-error';

/**
 * A certificate and its key, parsed and checked against the host they are meant to serve.
 *
 * This is the gate every uploaded certificate passes through, and it exists because all four of its
 * refusals are silent in production otherwise: a mismatched key fails at the TLS handshake and
 * nowhere else, a certificate for the wrong name fails only in the visitor's browser, and an expired
 * one fails everywhere at once at a time nobody chose. Catching them while somebody is still looking
 * at the form is the whole point.
 *
 * It reads only what the certificate itself says. Nothing here is inferred, defaulted or prettified
 * — the issuer, the names, the dates and the fingerprint shown in the admin are the ones in the file.
 */
export class CertificateMaterial {
  private static readonly BLOCK = /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g;

  private constructor(
    readonly certificatePem: string,
    readonly privateKeyPem: string,
    readonly issuer: string,
    readonly subject: string,
    readonly subjectAltNames: readonly string[],
    readonly serial: string,
    readonly fingerprintSha256: string,
    readonly notBefore: Date,
    readonly notAfter: Date,
  ) {}

  /**
   * Parse and check a pasted certificate chain and key for `host`.
   *
   * Order matters: each check assumes the previous one passed, and the FIRST failure is the one
   * reported, so the operator is told the earliest thing that is wrong rather than a cascade.
   *
   * @throws CertificateValidationError with the specific reason.
   */
  static parse(certificateInput: unknown, privateKeyInput: unknown, host: string): CertificateMaterial {
    const chain = CertificateMaterial.readChain(certificateInput);
    const leaf = CertificateMaterial.readLeaf(chain[0]);
    const key = CertificateMaterial.readKey(privateKeyInput);

    if (!leaf.checkPrivateKey(key)) {
      throw new CertificateValidationError(CertificateRejection.KEY_MISMATCH);
    }

    const notAfter = leaf.validToDate;
    if (notAfter.getTime() <= Date.now()) {
      throw new CertificateValidationError(CertificateRejection.ALREADY_EXPIRED, notAfter.toISOString());
    }

    // `checkHost` is the same matching a browser does, wildcards included: SANs when the certificate
    // has them, the common name only when it does not. Using anything else here would accept a
    // certificate that browsers then reject, which is the failure this check exists to prevent.
    const normalizedHost = String(host || '').trim().toLowerCase().replace(/\.$/, '');
    if (!normalizedHost || !leaf.checkHost(normalizedHost)) {
      throw new CertificateValidationError(CertificateRejection.HOST_NOT_COVERED, normalizedHost);
    }

    return new CertificateMaterial(
      chain.join('\n'),
      CertificateMaterial.exportKey(key),
      leaf.issuer,
      leaf.subject,
      CertificateMaterial.readAltNames(leaf),
      leaf.serialNumber,
      leaf.fingerprint256,
      leaf.validFromDate,
      notAfter,
    );
  }

  /**
   * Read a stored certificate WITHOUT re-checking it.
   *
   * A stored certificate has already passed `parse`, and re-running the host and expiry checks on
   * read would make an expired row unreadable — exactly when the admin most needs to display it.
   */
  static describeStored(certificatePem: unknown): X509Certificate | null {
    const blocks = String(certificatePem || '').match(CertificateMaterial.BLOCK);
    if (!blocks?.length) return null;
    try {
      return new X509Certificate(blocks[0]);
    } catch {
      return null;
    }
  }

  /** Every PEM certificate block in the pasted text, in order. The first is the leaf. */
  private static readChain(input: unknown): string[] {
    const blocks = String(input || '').trim().match(CertificateMaterial.BLOCK);
    if (!blocks?.length) {
      throw new CertificateValidationError(CertificateRejection.CERTIFICATE_UNREADABLE);
    }
    return blocks;
  }

  private static readLeaf(pem: string): X509Certificate {
    try {
      return new X509Certificate(pem);
    } catch (error: any) {
      throw new CertificateValidationError(CertificateRejection.CERTIFICATE_UNREADABLE, error?.message);
    }
  }

  /**
   * The private key.
   *
   * A passphrase-protected key lands here as unreadable, which is the honest answer: serving it
   * would require the platform to hold the passphrase alongside the key, which protects nothing.
   */
  private static readKey(input: unknown) {
    const pem = String(input || '').trim();
    if (!pem) {
      throw new CertificateValidationError(CertificateRejection.PRIVATE_KEY_UNREADABLE);
    }
    try {
      return createPrivateKey(pem);
    } catch (error: any) {
      throw new CertificateValidationError(CertificateRejection.PRIVATE_KEY_UNREADABLE, error?.message);
    }
  }

  /** Re-exported in one canonical PKCS#8 form, so what is stored does not depend on what was pasted. */
  private static exportKey(key: ReturnType<typeof createPrivateKey>): string {
    return String(key.export({ type: 'pkcs8', format: 'pem' }));
  }

  /**
   * The DNS names the certificate covers.
   *
   * `subjectAltName` is a flat string of `TYPE:value` pairs; only the DNS ones are names a host can
   * match, so IP entries are kept out rather than shown as if they were hostnames.
   */
  private static readAltNames(leaf: X509Certificate): string[] {
    return String(leaf.subjectAltName || '')
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.toLowerCase().startsWith('dns:'))
      .map((entry) => entry.slice(4).trim().toLowerCase())
      .filter((name) => name.length > 0);
  }
}

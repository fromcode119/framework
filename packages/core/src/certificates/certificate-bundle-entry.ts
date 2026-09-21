/**
 * One host's certificate and key, as they travel to whatever terminates TLS.
 *
 * Deliberately not a `CertificateRecord`: the terminator has no use for the issuer, the state or the
 * error text, and the less that travels beside a private key the better. `notAfter` and `wildcard`
 * are the only extras: the first so the terminator can report what it holds without parsing the
 * chain, the second so it knows the certificate covers `*.<host>` without parsing it either.
 */
export class CertificateBundleEntry {
  private constructor(
    readonly host: string,
    readonly certificatePem: string,
    readonly privateKeyPem: string,
    readonly notAfter: Date | null,
    /** Whether this certificate also covers `*.<host>` — one label deep, as X.509 wildcards do. */
    readonly wildcard: boolean = false,
  ) {}

  /** Hydrate one wire entry, or null when it carries no usable material. */
  static from(raw: unknown): CertificateBundleEntry | null {
    const bag = raw as Record<string, unknown> | undefined;
    const host = String(bag?.host ?? '').trim().toLowerCase();
    const certificatePem = String(bag?.certificatePem ?? '');
    const privateKeyPem = String(bag?.privateKeyPem ?? '');
    if (!host || !certificatePem || !privateKeyPem) return null;

    const notAfterRaw = bag?.notAfter ? new Date(String(bag.notAfter)) : null;
    const notAfter = notAfterRaw && !Number.isNaN(notAfterRaw.getTime()) ? notAfterRaw : null;
    return new CertificateBundleEntry(host, certificatePem, privateKeyPem, notAfter, bag?.wildcard === true);
  }
}

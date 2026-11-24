import { X509Certificate } from 'crypto';
import type * as pkijs from 'pkijs';
import { SystemConstants } from '@core/constants/system.constants';
import { SecretService } from '@core/security/secret-service';
import { EdgeX509 } from '@core/security/edge/identity/edge-x509';
import type { EdgeIdentityPolicy } from '@core/security/edge/identity/edge-identity-policy';

/**
 * The platform's authority for edges: the only thing that can say "this is one of our edges".
 *
 * Two tiers, as every public and private PKI does. The ROOT signs nothing but working certificates, so
 * its key is used once a month; the WORKING certificate signs edge certificates. A new working
 * certificate is made every `intermediateDays`; the previous one is retired but stays trusted until it
 * runs out, which is after every certificate it signed has run out — so rotation never cuts an edge off.
 *
 * Several api processes can ask at once. Creation is insert-then-reread: the earliest row wins and any
 * other made in the same moment is retired at once, so there is never more than one in use.
 *
 * Keys are encrypted at rest with the deployment's secret, like every private key the platform holds,
 * and an installation that cannot encrypt refuses to make an authority rather than storing one in clear.
 */
export class EdgeCertificateAuthority {
  private static readonly TABLE = SystemConstants.TABLE.EDGE_CA;
  private static readonly ROOT = 'root';
  private static readonly WORKING = 'working';
  /** A root outlives anything it vouches for by far; replacing it means adding every edge again. */
  static readonly ROOT_YEARS = 10;
  private static readonly CLOCK_SKEW_MS = 5 * 60_000;

  constructor(
    private readonly db: any,
    private readonly policy: () => EdgeIdentityPolicy,
    private readonly now: () => number = Date.now,
  ) {}

  /** What every party trusts: the root, as PEM. */
  async trustBundle(): Promise<string> {
    return (await this.root()).certificatePem;
  }

  /** Signs a certificate for the key a verified request carries. `serverAuth` is for the platform's own listeners. */
  async issue(publicKey: pkijs.PublicKeyInfo, name: string, identity: { uri?: string; dnsNames?: string[]; ipAddresses?: string[] }, purpose: { clientAuth?: boolean; serverAuth?: boolean }): Promise<{ certificatePem: string; chainPem: string; serial: string; notAfter: Date }> {
    const working = await this.working();
    const now = this.now();
    const wanted = now + this.policy().certificateHours * 3_600_000;
    const notAfter = new Date(Math.min(wanted, working.notAfter.getTime()));
    const serial = EdgeX509.serial();
    const certificatePem = await EdgeX509.certificate({
      serial,
      subject: name,
      issuer: working.subject,
      notBefore: new Date(now - EdgeCertificateAuthority.CLOCK_SKEW_MS),
      notAfter,
      publicKey,
      signingKey: await EdgeX509.importPrivateKey(working.privateKeyPem),
      issuerKeyId: EdgeX509.keyIdOf(working.certificatePem),
      ...identity,
      ...purpose,
    });
    return { certificatePem, chainPem: working.certificatePem, serial, notAfter };
  }

  /** The authority's state for the console: when each certificate runs out. Never a key. */
  async describe(): Promise<{ rootNotAfter: string; workingNotAfter: string; workingSince: string }> {
    const root = await this.root();
    const working = await this.working();
    return { rootNotAfter: root.notAfter.toISOString(), workingNotAfter: working.notAfter.toISOString(), workingSince: working.notBefore.toISOString() };
  }

  private async root(): Promise<{ certificatePem: string; privateKeyPem: string; subject: string; notAfter: Date }> {
    const existing = await this.active(EdgeCertificateAuthority.ROOT);
    if (existing) return existing;
    EdgeCertificateAuthority.requireEncryption();
    const keys = await EdgeX509.generateKeyPair();
    const now = this.now();
    const subject = `${this.policy().trustDomain} Edge Root`;
    const notAfter = new Date(now + EdgeCertificateAuthority.ROOT_YEARS * 365 * 86_400_000);
    const certificatePem = await EdgeX509.certificate({
      serial: EdgeX509.serial(), subject, issuer: subject, notBefore: new Date(now - EdgeCertificateAuthority.CLOCK_SKEW_MS), notAfter,
      publicKey: keys.publicKey, signingKey: keys.privateKey, authority: true, pathLength: 1,
    });
    await this.store(EdgeCertificateAuthority.ROOT, certificatePem, await EdgeX509.exportPrivateKey(keys.privateKey), now, notAfter);
    return (await this.settle(EdgeCertificateAuthority.ROOT))!;
  }

  /** The working certificate, made or replaced when due. */
  private async working(): Promise<{ certificatePem: string; privateKeyPem: string; subject: string; notBefore: Date; notAfter: Date }> {
    const policy = this.policy();
    const current = await this.active(EdgeCertificateAuthority.WORKING);
    const now = this.now();
    if (current && now - current.notBefore.getTime() < policy.intermediateDays * 86_400_000) return current;

    const root = await this.root();
    const keys = await EdgeX509.generateKeyPair();
    const subject = `${policy.trustDomain} Edge Working ${new Date(now).toISOString().slice(0, 10)}`;
    // Twice the rotation period plus one edge certificate: the retired one outlives everything it signed.
    const notAfter = new Date(Math.min(now + 2 * policy.intermediateDays * 86_400_000 + policy.certificateHours * 3_600_000, root.notAfter.getTime()));
    const certificatePem = await EdgeX509.certificate({
      serial: EdgeX509.serial(), subject, issuer: root.subject, notBefore: new Date(now - EdgeCertificateAuthority.CLOCK_SKEW_MS), notAfter,
      publicKey: keys.publicKey, signingKey: await EdgeX509.importPrivateKey(root.privateKeyPem), issuerKeyId: EdgeX509.keyIdOf(root.certificatePem), authority: true, pathLength: 0,
    });
    await this.store(EdgeCertificateAuthority.WORKING, certificatePem, await EdgeX509.exportPrivateKey(keys.privateKey), now, notAfter);
    // Retired before settling, so the new one — not the one it replaces — is the earliest left in use.
    // Retired is not distrusted: the trust bundle is the root, and the old one stays valid until it runs out.
    if (current) await this.db.update(EdgeCertificateAuthority.TABLE, { id: current.id }, { retired_at: new Date(now).toISOString() });
    return (await this.settle(EdgeCertificateAuthority.WORKING))!;
  }

  private async store(kind: string, certificatePem: string, privateKeyPem: string, now: number, notAfter: Date): Promise<void> {
    await this.db.insert(EdgeCertificateAuthority.TABLE, {
      kind,
      serial: EdgeX509.serial(),
      certificate_pem: certificatePem,
      private_key_enc: SecretService.encrypt(privateKeyPem),
      not_before: new Date(now - EdgeCertificateAuthority.CLOCK_SKEW_MS).toISOString(),
      not_after: notAfter.toISOString(),
      created_at: new Date(now).toISOString(),
    });
  }

  /** After a creation: the earliest row in use stays, and any other made by a racing process is retired. */
  private async settle(kind: string) {
    const [, ...extra] = await this.rows(kind);
    for (const row of extra) await this.db.update(EdgeCertificateAuthority.TABLE, { id: row.id }, { retired_at: new Date(this.now()).toISOString() });
    return this.active(kind);
  }

  private async active(kind: string) {
    const row = (await this.rows(kind))[0];
    if (!row) return null;
    return {
      id: Number(row.id),
      certificatePem: String(row.certificate_pem),
      privateKeyPem: SecretService.decrypt(row.private_key_enc),
      subject: EdgeCertificateAuthority.subjectOf(String(row.certificate_pem)),
      notBefore: new Date(row.not_before),
      notAfter: new Date(row.not_after),
    };
  }

  /** Rows of a kind in use and not run out, the first-made first (so racing creators agree on the same one). */
  private async rows(kind: string): Promise<any[]> {
    const now = new Date(this.now()).toISOString();
    return (await this.db.find(EdgeCertificateAuthority.TABLE, {
      where: { kind, retired_at: null, not_after: { gt: now } },
      orderBy: { id: 'asc' },
    })) || [];
  }

  private static subjectOf(certificatePem: string): string {
    return new X509Certificate(certificatePem).subject.replace(/^CN=/, '');
  }

  private static requireEncryption(): void {
    if (!SecretService.isEncryptionAvailable()) {
      throw new Error('Adding edges requires SECRET_KEY (or INTEGRATION_SECRET_KEY) on the server: the authority\'s keys are never stored unencrypted.');
    }
  }
}

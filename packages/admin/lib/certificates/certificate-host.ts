import { CoercionUtils } from '@fromcode119/core';

/**
 * One row of the certificates screen, as the admin holds it.
 *
 * A host the platform serves, and the certificate it has — or has not. The "has not" case is a real
 * row rather than an absence, because a host serving traffic with nothing to serve it over HTTPS is
 * the most important thing this screen can tell anyone.
 *
 * Everything here comes from the api's `toAdminJson()`, which has no private key to give.
 */
export class CertificateHost {
  private constructor(
    readonly host: string,
    readonly role: string,
    readonly isPlatformHost: boolean,
    readonly tenantId: string,
    readonly tenantSlug: string,
    readonly state: string,
    readonly tone: string,
    readonly needsAttention: boolean,
    readonly daysRemaining: number | null,
    readonly source: string,
    readonly issuer: string,
    readonly notAfter: string,
    readonly subjectAltNames: string[],
    readonly fingerprint: string,
    readonly lastError: string,
  ) {}

  static from(raw: unknown): CertificateHost {
    const bag = (raw ?? {}) as Record<string, any>;
    const certificate = (bag.certificate ?? {}) as Record<string, any>;
    return new CertificateHost(
      CoercionUtils.toString(bag.host),
      CoercionUtils.toString(bag.role),
      bag.isPlatformHost === true,
      CoercionUtils.toString(bag.tenantId ?? ''),
      CoercionUtils.toString(bag.tenantSlug ?? ''),
      CoercionUtils.toString(bag.state),
      CoercionUtils.toString(bag.tone),
      bag.needsAttention === true,
      bag.daysRemaining === null || bag.daysRemaining === undefined ? null : Number(bag.daysRemaining),
      CoercionUtils.toString(certificate.source ?? ''),
      CoercionUtils.toString(certificate.issuer ?? ''),
      CoercionUtils.toString(certificate.notAfter ?? ''),
      Array.isArray(certificate.subjectAltNames) ? certificate.subjectAltNames.map((n: unknown) => String(n)) : [],
      CoercionUtils.toString(certificate.fingerprintSha256 ?? ''),
      CoercionUtils.toString(certificate.lastError ?? ''),
    );
  }

  static fromList(raw: unknown): CertificateHost[] {
    return Array.isArray(raw) ? raw.map((entry) => CertificateHost.from(entry)) : [];
  }

  get hasCertificate(): boolean {
    return this.notAfter.length > 0;
  }

  /** What the badge says. Plain words, because "RENEWAL_DUE" is not a sentence. */
  get stateLabel(): string {
    const labels: Record<string, string> = {
      no_certificate: 'No certificate',
      waiting_for_dns: 'Waiting for DNS',
      issuing: 'Issuing',
      serving: 'Valid',
      renewal_due: 'Renewal due',
      failed: 'Failed',
      expiring: 'Expiring',
      expired: 'Expired',
    };
    return labels[this.state] ?? this.state;
  }

  /** Which of these a human recognises: "Main address", "Admin console". */
  get roleLabel(): string {
    const labels: Record<string, string> = {
      primary: 'Main address',
      alias: 'Alias',
      platform_admin: 'Admin console',
      platform_api: 'API',
      platform_frontend: 'Platform storefront',
    };
    return labels[this.role] ?? this.role;
  }

  /**
   * How long is left, in words.
   *
   * Returns '' when there is no certificate — the caller renders nothing rather than "0 days", which
   * would read as "expires today" for a host that has never had one.
   */
  get remainingLabel(): string {
    if (!this.hasCertificate || this.daysRemaining === null) return '';
    if (this.daysRemaining < 0) return `Expired ${Math.abs(this.daysRemaining)}d ago`;
    if (this.daysRemaining === 0) return 'Expires today';
    if (this.daysRemaining === 1) return '1 day left';
    return `${this.daysRemaining} days left`;
  }

  /** The date an operator reads, or '' when there is nothing to date. */
  get expiryDate(): string {
    return this.notAfter ? this.notAfter.slice(0, 10) : '';
  }

  /** Whether the platform renews this one. Uploaded certificates are nobody's job but the operator's. */
  get isUploaded(): boolean {
    return this.source === 'uploaded';
  }

  /** Whether the platform already obtains and renews this host's certificate. */
  get isPlatformManaged(): boolean {
    return this.source === 'automatic';
  }
}

import { CertificateHostRole, CertificateRecord, CertificateState } from '@fromcode119/core';

/**
 * One row of the certificates screen: a host the platform serves, and whatever certificate it has.
 *
 * BUILT FROM THE HOSTS, NOT FROM THE CERTIFICATES. A list assembled from stored certificates can
 * only ever show hosts that already have one, which hides the single most important row on the
 * page — the host serving traffic with no certificate at all. So every served host appears, and the
 * certificate is the optional half.
 */
export class CertificateHostEntry {
  constructor(
    readonly host: string,
    readonly role: CertificateHostRole,
    readonly tenantId: string | null,
    readonly tenantSlug: string | null,
    readonly certificate: CertificateRecord | null,
  ) {}

  /** The state of this host, which is NO_CERTIFICATE when nothing is stored for it. */
  get state(): CertificateState {
    return this.certificate?.state ?? CertificateState.NO_CERTIFICATE;
  }

  toJson(): Record<string, unknown> {
    return {
      host: this.host,
      role: this.role.value,
      roleKey: this.role.translationKey,
      isPlatformHost: this.role.isPlatform,
      tenantId: this.tenantId,
      tenantSlug: this.tenantSlug,
      state: this.state.value,
      tone: this.state.tone,
      needsAttention: this.state.needsAttention,
      daysRemaining: this.certificate?.daysRemaining ?? null,
      certificate: this.certificate ? this.certificate.toAdminJson() : null,
    };
  }
  /**
   * The order the Certificates screen reads in: soonest expiry first, because that is the only
   * question an operator actually has — what is about to break. Hosts with nothing stored come
   * after everything that can expire, and among those the platform's own come first, since losing
   * the admin host locks everybody out of the screen they would use to fix it.
   */
  static byUrgency(left: CertificateHostEntry, right: CertificateHostEntry): number {
    const leftExpiry = left.certificate?.notAfter?.getTime() ?? null;
    const rightExpiry = right.certificate?.notAfter?.getTime() ?? null;

    if (leftExpiry !== null && rightExpiry !== null) {
      return leftExpiry === rightExpiry ? left.host.localeCompare(right.host) : leftExpiry - rightExpiry;
    }
    if (leftExpiry !== null) return -1;
    if (rightExpiry !== null) return 1;

    if (left.role.isPlatform !== right.role.isPlatform) return left.role.isPlatform ? -1 : 1;
    return left.host.localeCompare(right.host);
  }

}

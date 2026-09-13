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
}

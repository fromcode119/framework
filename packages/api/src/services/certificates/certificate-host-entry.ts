import { CertificateHostRole, CertificateRecord, CertificateState, WildcardHostCoverage } from '@fromcode119/core';

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
    /**
     * The WILDCARD certificate covering this host, when it has none of its own.
     *
     * Without it the screen said "cannot be served over HTTPS by this platform" about a host the
     * gateway was serving perfectly well from a wildcard — wrong, and an invitation to order a
     * second certificate for a name that already had one.
     */
    readonly coveredBy: CertificateRecord | null = null,
  ) {}

  /**
   * One served host's row, resolving what will actually serve it.
   *
   * Its own stored certificate wins. Failing that, a WILDCARD stored elsewhere may cover it —
   * `*.fromcode.com` lives on the `fromcode.com` row — and `WildcardHostCoverage` is the SAME rule
   * the gateway applies at handshake time, shared deliberately so this screen cannot disagree with
   * what is served. Only a wildcard that actually HAS material counts; one still being ordered
   * serves nothing yet and must not be reported as cover.
   */
  static forServedHost(
    host: string,
    role: CertificateHostRole,
    tenantId: string | null,
    tenantSlug: string | null,
    stored: Map<string, CertificateRecord>,
  ): CertificateHostEntry {
    const own = stored.get(host) ?? null;
    if (own) return new CertificateHostEntry(host, role, tenantId, tenantSlug, own);

    const parent = stored.get(WildcardHostCoverage.parentOf(host));
    const cover = parent?.wildcard && parent.hasMaterial ? parent : null;
    return new CertificateHostEntry(host, role, tenantId, tenantSlug, null, cover);
  }

  /**
   * The state of this host. Its own certificate answers first; a wildcard covering it answers next,
   * because that is what the gateway will actually serve. NO_CERTIFICATE only when neither exists.
   */
  get state(): CertificateState {
    return this.certificate?.state ?? this.coveredBy?.state ?? CertificateState.NO_CERTIFICATE;
  }

  /** The certificate that will actually be served for this host, whosever row it lives on. */
  get effective(): CertificateRecord | null {
    return this.certificate ?? this.coveredBy;
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
      daysRemaining: this.effective?.daysRemaining ?? null,
      certificate: this.certificate ? this.certificate.toAdminJson() : null,
      // The host whose wildcard covers this one, or null. Named rather than implied: an operator
      // must be able to see WHERE the certificate serving this host actually lives, and go to it.
      coveredByHost: this.certificate ? null : (this.coveredBy?.host ?? null),
      // The cover's own expiry, because this row has no `certificate` to read one from and a
      // "Served by the wildcard on x · until" with nothing after it is worse than saying nothing.
      coveredByNotAfter: this.certificate ? null : (this.coveredBy?.notAfter?.toISOString() ?? null),
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

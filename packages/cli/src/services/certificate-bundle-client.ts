import { CertificateBundle, InternalServiceAuth } from '@fromcode119/core';

/**
 * Keeps the gateway's copy of the platform's certificates.
 *
 * The same shape as `RoutingMapClient`, for the same reasons: fetched at start, refreshed on a
 * timer, refetched when the api pushes a reload after an upload, and the LAST GOOD bundle survives a
 * failed refresh. An api restart must not take HTTPS down with it — a certificate that was valid a
 * minute ago is still valid now, and dropping it would turn a brief api outage into a browser
 * security warning on every site.
 *
 * No secret configured → no bundle, and the gateway terminates nothing.
 */
export class CertificateBundleClient {
  static readonly ENV_TTL = 'GATEWAY_CERTIFICATES_TTL_MS';
  static readonly DEFAULT_TTL_MS = 60_000;
  private static readonly TIMEOUT_MS = 5000;

  private bundle: CertificateBundle | null = null;
  private fetchedAt = 0;
  private inflight: Promise<CertificateBundle | null> | null = null;

  constructor(
    private readonly certificatesUrl: string,
    private readonly ttlMs: number = CertificateBundleClient.readTtl(),
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  get enabled(): boolean {
    return InternalServiceAuth.isConfigured() && this.certificatesUrl.length > 0;
  }

  get current(): CertificateBundle | null {
    return this.bundle;
  }

  get ageMs(): number {
    return this.fetchedAt ? Date.now() - this.fetchedAt : -1;
  }

  /** The bundle, refreshing when stale; never throws — a failed refresh keeps the last good one. */
  async resolve(): Promise<CertificateBundle | null> {
    if (!this.enabled) return null;
    if (this.bundle && Date.now() - this.fetchedAt < this.ttlMs) return this.bundle;
    return this.refresh();
  }

  async refresh(): Promise<CertificateBundle | null> {
    if (!this.enabled) return null;
    if (this.inflight) return this.inflight;
    this.inflight = this.fetchBundle().finally(() => { this.inflight = null; });
    return this.inflight;
  }

  private async fetchBundle(): Promise<CertificateBundle | null> {
    try {
      const response = await this.fetchImpl(this.certificatesUrl, {
        headers: InternalServiceAuth.requestHeaders(),
        signal: AbortSignal.timeout(CertificateBundleClient.TIMEOUT_MS),
      });
      if (!response.ok) {
        console.warn(`[platform-gateway] certificates refused: HTTP ${response.status}; keeping the last bundle (${this.bundle?.size ?? 0})`);
        return this.bundle;
      }
      this.bundle = CertificateBundle.fromJson(await response.json());
      this.fetchedAt = Date.now();
      return this.bundle;
    } catch (error: any) {
      // Never log the response body here: it carries private keys.
      console.warn(`[platform-gateway] certificates unreachable: ${error?.message || error}; keeping the last bundle (${this.bundle?.size ?? 0})`);
      return this.bundle;
    }
  }

  private static readTtl(): number {
    const parsed = Number.parseInt(String(process.env[CertificateBundleClient.ENV_TTL] || ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : CertificateBundleClient.DEFAULT_TTL_MS;
  }
}

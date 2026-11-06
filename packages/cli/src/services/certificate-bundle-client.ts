import { CertificateBundle, CertificateBundleSnapshot, InternalServiceAuth } from '@fromcode119/core';

/**
 * Keeps the gateway's copy of the platform's certificates.
 *
 * The same shape as `RoutingMapClient`, for the same reasons: fetched at start, refreshed on a
 * timer, refetched when the api pushes a reload after an upload, and the LAST GOOD bundle survives a
 * failed refresh. An api restart must not take HTTPS down with it — a certificate that was valid a
 * minute ago is still valid now, and dropping it would turn a brief api outage into a browser
 * security warning on every site.
 *
 * A gateway that starts while the api is still down (an upgrade restarts both) has no last good
 * bundle in memory, so it falls back to the encrypted snapshot the api keeps in the data directory
 * (`CertificateBundleSnapshot`) — until then every handshake was refused for as long as the api took
 * to boot. The snapshot is only a starting point: it is never treated as fresh, so the next handshake
 * fetches again and the api's answer replaces it.
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
    private readonly readSnapshot: () => unknown = () => CertificateBundleSnapshot.read(),
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

  /**
   * The bundle, refreshing when stale; never throws — a failed refresh keeps the last good one.
   *
   * A handshake never waits on the api while a bundle is held: a stale one answers at once and the
   * refresh runs behind it. Only a gateway holding nothing at all waits for the first fetch.
   */
  async resolve(): Promise<CertificateBundle | null> {
    if (!this.enabled) return null;
    if (this.bundle && Date.now() - this.fetchedAt < this.ttlMs) return this.bundle;
    if (this.bundle) {
      void this.refresh();
      return this.bundle;
    }
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
        return this.lastGood();
      }
      this.bundle = CertificateBundle.fromJson(await response.json());
      this.fetchedAt = Date.now();
      return this.bundle;
    } catch (error: any) {
      // Never log the response body here: it carries private keys.
      console.warn(`[platform-gateway] certificates unreachable: ${error?.message || error}; keeping the last bundle (${this.bundle?.size ?? 0})`);
      return this.lastGood();
    }
  }

  /**
   * The bundle to keep serving when a fetch failed: the one in memory, else the stored snapshot. The
   * snapshot leaves `fetchedAt` untouched, so it never counts as fresh and the api is asked again.
   */
  private lastGood(): CertificateBundle | null {
    if (this.bundle) return this.bundle;
    const stored = this.readSnapshot();
    if (!stored) return null;
    const bundle = CertificateBundle.fromJson(stored);
    if (!bundle.size) return null;
    this.bundle = bundle;
    console.warn(`[platform-gateway] serving the stored certificate snapshot (${bundle.size}) until the api answers`);
    return this.bundle;
  }

  private static readTtl(): number {
    const parsed = Number.parseInt(String(process.env[CertificateBundleClient.ENV_TTL] || ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : CertificateBundleClient.DEFAULT_TTL_MS;
  }
}

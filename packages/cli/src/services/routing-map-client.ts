import { InternalServiceAuth, TenantRouteMap } from '@fromcode119/core';

/**
 * Keeps the gateway's copy of the api's host → app map (T6 §3.1).
 *
 * Fetched at start, refreshed on a timer, and refetched on demand when the api pushes a reload after a
 * tenant change. The LAST GOOD map survives a failed refresh: an api restart must not take routing
 * down with it. No secret configured → no map at all, and the gateway routes by path only (the
 * single-domain mode it always had).
 */
export class RoutingMapClient {
  static readonly ENV_TTL = 'GATEWAY_ROUTING_TTL_MS';
  static readonly DEFAULT_TTL_MS = 30_000;
  private static readonly TIMEOUT_MS = 5000;

  private map: TenantRouteMap | null = null;
  private fetchedAt = 0;
  private inflight: Promise<TenantRouteMap | null> | null = null;

  constructor(
    private readonly routingUrl: string,
    private readonly ttlMs: number = RoutingMapClient.readTtl(),
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  get enabled(): boolean {
    return InternalServiceAuth.isConfigured() && this.routingUrl.length > 0;
  }

  get current(): TenantRouteMap | null {
    return this.map;
  }

  get ageMs(): number {
    return this.fetchedAt ? Date.now() - this.fetchedAt : -1;
  }

  /** The map, refreshing when stale; never throws — a failed refresh keeps the last good map. */
  async resolveMap(): Promise<TenantRouteMap | null> {
    if (!this.enabled) return null;
    if (this.map && Date.now() - this.fetchedAt < this.ttlMs) return this.map;
    return this.refresh();
  }

  async refresh(): Promise<TenantRouteMap | null> {
    if (!this.enabled) return null;
    if (this.inflight) return this.inflight;
    this.inflight = this.fetchMap().finally(() => { this.inflight = null; });
    return this.inflight;
  }

  private async fetchMap(): Promise<TenantRouteMap | null> {
    try {
      const response = await this.fetchImpl(this.routingUrl, { headers: InternalServiceAuth.requestHeaders(), signal: AbortSignal.timeout(RoutingMapClient.TIMEOUT_MS) });
      if (!response.ok) {
        console.warn(`[platform-gateway] routing map refused: HTTP ${response.status}; keeping the last map (${this.map?.size ?? 0} hosts)`);
        return this.map;
      }
      this.map = TenantRouteMap.fromJson(await response.json());
      this.fetchedAt = Date.now();
      return this.map;
    } catch (error: any) {
      console.warn(`[platform-gateway] routing map unreachable: ${error?.message || error}; keeping the last map (${this.map?.size ?? 0} hosts)`);
      return this.map;
    }
  }

  private static readTtl(): number {
    const parsed = Number.parseInt(String(process.env[RoutingMapClient.ENV_TTL] || ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : RoutingMapClient.DEFAULT_TTL_MS;
  }
}

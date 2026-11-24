import { ApiPathUtils, InternalServiceAuth, RouteConstants } from '@fromcode119/core';

/**
 * Tells the api what the gateway did on its own, so an operator sees it (Settings → Security → Stopped
 * addresses) and is told (the "Edge security" alert):
 *
 * - a stop, the moment it is made;
 * - how many requests it refused from stopped addresses, gathered and sent once every {@link FLUSH_MS};
 * - its watchdog restarting it, just before it goes.
 *
 * Best effort, like the routing reload: a report that cannot be sent never holds up a request, and a
 * deployment with no internal secret has nowhere to send it.
 */
export class GatewayEdgeReporter {
  static readonly FLUSH_MS = 60_000;
  private static readonly TIMEOUT_MS = 3_000;
  /** Addresses whose refusals are counted between flushes; a flood of new ones is not held in memory. */
  private static readonly MAX_COUNTED = 10_000;

  private readonly refused = new Map<string, number>();
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly apiBase: string = String(process.env.API_TARGET_URL || 'http://api:3000'),
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private get enabled(): boolean {
    return InternalServiceAuth.isConfigured();
  }

  /** A stop just made. */
  stopped(stop: { address: string; until: string; strikes: number; hosts: string[]; paths: string[] }, reason: string): void {
    void this.post(RouteConstants.SEGMENTS.INTERNAL_EDGE_STOPS, { stop: { ...stop, reason } });
  }

  /** One request refused from a stopped address. */
  refusedFrom(address: string): void {
    if (!this.enabled) return;
    if (!this.refused.has(address) && this.refused.size >= GatewayEdgeReporter.MAX_COUNTED) return;
    this.refused.set(address, (this.refused.get(address) ?? 0) + 1);
    this.timer ??= setTimeout(() => { this.timer = null; void this.flush(); }, GatewayEdgeReporter.FLUSH_MS);
    this.timer.unref?.();
  }

  /** Sends the refusals counted since the last flush. */
  async flush(): Promise<void> {
    if (!this.refused.size) return;
    const refused = Object.fromEntries(this.refused);
    this.refused.clear();
    await this.post(RouteConstants.SEGMENTS.INTERNAL_EDGE_STOPS, { refused });
  }

  /** The watchdog is restarting the gateway. Awaited, so it is sent before the process exits. */
  async restarting(reason: string): Promise<void> {
    await this.post(RouteConstants.SEGMENTS.INTERNAL_EDGE_EVENTS, { kind: 'gateway_restarted', reason });
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private async post(segment: string, body: Record<string, unknown>): Promise<void> {
    if (!this.enabled) return;
    try {
      const response = await this.fetchImpl(`${this.apiBase.replace(/\/+$/, '')}${ApiPathUtils.versioned(segment)}`, {
        method: 'POST',
        headers: { ...InternalServiceAuth.requestHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(GatewayEdgeReporter.TIMEOUT_MS),
      });
      if (!response.ok) console.warn(`[platform-gateway] the api did not take the edge report: HTTP ${response.status}`);
    } catch (error: any) {
      console.warn(`[platform-gateway] could not send the edge report: ${error?.message || error}`);
    }
  }
}

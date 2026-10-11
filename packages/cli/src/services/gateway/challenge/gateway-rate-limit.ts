import { NetworkAddressUtils } from '@fromcode119/core';

/**
 * Requests per visitor per minute at the gateway (Settings → Security → Edge protection), across every
 * site. A fixed one-minute window per address, in memory: the gateway is the one process every
 * request passes, and a window that restarts with it costs at most one minute of counting.
 *
 * The platform's own servers are never counted: anything from a private address is a container on
 * the platform's network, not a visitor.
 */
export class GatewayRateLimit {
  private static readonly WINDOW_MS = 60_000;
  /** Visitors remembered at once; the oldest window is dropped beyond it. */
  private static readonly MAX_TRACKED = 200_000;

  private readonly windows = new Map<string, { startedAt: number; count: number }>();

  constructor(private readonly now: () => number = Date.now) {}

  /** Seconds this visitor must wait, or 0 when the request may pass. */
  retryAfter(address: string | undefined, limitPerMinute: number): number {
    if (!(limitPerMinute > 0) || !address) return 0;
    const visitor = NetworkAddressUtils.normalize(address);
    if (!visitor || NetworkAddressUtils.isPrivate(visitor)) return 0;
    const now = this.now();
    let window = this.windows.get(visitor);
    if (!window || now - window.startedAt >= GatewayRateLimit.WINDOW_MS) {
      window = { startedAt: now, count: 0 };
      this.windows.delete(visitor);
      this.windows.set(visitor, window);
      this.forgetOldest();
    }
    window.count += 1;
    if (window.count <= limitPerMinute) return 0;
    return Math.max(1, Math.ceil((window.startedAt + GatewayRateLimit.WINDOW_MS - now) / 1000));
  }

  private forgetOldest(): void {
    while (this.windows.size > GatewayRateLimit.MAX_TRACKED) {
      const oldest = this.windows.keys().next().value;
      if (oldest === undefined) return;
      this.windows.delete(oldest);
    }
  }
}

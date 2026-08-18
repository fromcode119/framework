/**
 * Sliding-window throttle for the anonymous share endpoints.
 *
 * Keyed on the client ADDRESS, never on a header a caller controls — a limiter keyed on something the
 * attacker sets is not a limiter. The address is derived once, by the controller, from `req.ip` with
 * `x-forwarded-for` as the proxy fallback.
 *
 * These endpoints need their own bucket because they are the only unauthenticated way to reach stored
 * bytes: without one, a token is guessable at whatever rate the global API limiter allows, and a valid
 * token is enumerable across every file in its share.
 */
export class FileShareRateLimiter {
  private static readonly WINDOW_MS = 60_000;
  private static store = new Map<string, { count: number; resetAt: number }>();

  static isLimited(address: string, limit: number): boolean {
    if (limit <= 0) return false;

    const entry = FileShareRateLimiter.store.get(address);
    if (!entry || Date.now() > entry.resetAt) return false;

    return entry.count >= limit;
  }

  static record(address: string): void {
    const now = Date.now();
    const entry = FileShareRateLimiter.store.get(address);

    if (!entry || now > entry.resetAt) {
      FileShareRateLimiter.store.set(address, { count: 1, resetAt: now + FileShareRateLimiter.WINDOW_MS });
      FileShareRateLimiter.prune(now);
      return;
    }

    entry.count += 1;
  }

  /**
   * Drops expired entries so the map cannot grow without bound. In-memory and per-process: a restart
   * clears it, and a multi-process deployment limits per process. Both are acceptable for a throttle
   * that exists to slow enumeration rather than to enforce a quota.
   */
  private static prune(now: number): void {
    if (FileShareRateLimiter.store.size < 1000) return;
    for (const [key, value] of FileShareRateLimiter.store) {
      if (now > value.resetAt) FileShareRateLimiter.store.delete(key);
    }
  }

  /** Test seam — the window is real time, so a suite needs a way back to a known state. */
  static reset(): void {
    FileShareRateLimiter.store.clear();
  }
}

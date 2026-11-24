import { NetworkAddressUtils } from '@fromcode119/core';

/**
 * Stops an address that keeps probing (Settings → Security → Edge protection → "Stop a scanner after"):
 * once it has been refused for an attack, a blocked path or a blocked tool that many times within
 * {@link WINDOW_MS}, every request it makes to any site is refused for the configured minutes, before
 * anything is routed. A scanner tries hundreds of addresses; after the first few it costs nothing.
 *
 * Only refusals count, never a 404: a visitor who mistypes an address is not a scanner, while no
 * browser ever asks for `/.env` or carries `union select`. The platform's own servers are never counted.
 * In memory, like the rate limit: a gateway restart forgets the bans, and a scanner that comes back
 * earns a new one within a few requests.
 */
export class GatewayScannerBan {
  private static readonly WINDOW_MS = 10 * 60_000;
  /** Addresses remembered at once; the oldest is dropped beyond it. */
  private static readonly MAX_TRACKED = 100_000;

  private readonly visitors = new Map<string, { firstAt: number; strikes: number; bannedUntil: number }>();

  constructor(private readonly now: () => number = Date.now) {}

  /** Whether this address is stopped right now. */
  isBanned(address: string | undefined): boolean {
    const visitor = GatewayScannerBan.visitorOf(address);
    if (!visitor) return false;
    const entry = this.visitors.get(visitor);
    return entry !== undefined && entry.bannedUntil > this.now();
  }

  /**
   * Counts one refusal of this address; true when it has just been stopped. `after` 0 (or `minutes` 0)
   * turns stopping off.
   */
  strike(address: string | undefined, after: number, minutes: number): boolean {
    if (!(after > 0) || !(minutes > 0)) return false;
    const visitor = GatewayScannerBan.visitorOf(address);
    if (!visitor) return false;
    const now = this.now();
    let entry = this.visitors.get(visitor);
    // A ban that has run out starts the count again, as does a window that has passed.
    const expired = entry !== undefined && entry.bannedUntil > 0 && entry.bannedUntil <= now;
    if (!entry || expired || (entry.bannedUntil === 0 && now - entry.firstAt >= GatewayScannerBan.WINDOW_MS)) {
      entry = { firstAt: now, strikes: 0, bannedUntil: 0 };
    }
    this.visitors.delete(visitor);
    this.visitors.set(visitor, entry);
    this.forgetOldest();
    entry.strikes += 1;
    if (entry.strikes < after || entry.bannedUntil > now) return false;
    entry.bannedUntil = now + minutes * 60_000;
    return true;
  }

  private static visitorOf(address: string | undefined): string | null {
    const visitor = NetworkAddressUtils.normalize(address);
    return visitor && !NetworkAddressUtils.isPrivate(visitor) ? visitor : null;
  }

  private forgetOldest(): void {
    while (this.visitors.size > GatewayScannerBan.MAX_TRACKED) {
      const oldest = this.visitors.keys().next().value;
      if (oldest === undefined) return;
      this.visitors.delete(oldest);
    }
  }
}

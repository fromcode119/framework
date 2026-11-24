import { NetworkAddressUtils } from '@fromcode119/core';
import type { EdgeStop } from '@fromcode119/core';

/**
 * Stops an address that keeps probing (Settings → Security → Edge protection → "Stop a scanner after"):
 * once it has been refused for an attack, a blocked path or a blocked tool that many times within
 * {@link WINDOW_MS}, every request it makes to any site is refused for the configured minutes, before
 * anything is routed. A scanner tries hundreds of addresses; after the first few it costs nothing.
 *
 * Only refusals count, never a 404: a visitor who mistypes an address is not a scanner, while no
 * browser ever asks for `/.env` or carries `union select`. The platform's own servers are never counted.
 *
 * A stop is decided here, in memory, and reported to the api, which records it (Settings → Security →
 * Stopped addresses). The routing map then carries every recorded stop back ({@link sync}): that is how
 * a stop outlives a gateway restart, and how an operator's "Release" reaches the gateway.
 */
export class GatewayScannerBan {
  private static readonly WINDOW_MS = 10 * 60_000;
  /** Addresses remembered at once; the oldest is dropped beyond it. */
  private static readonly MAX_TRACKED = 100_000;
  /** Hosts and paths kept per address — what the console shows it asked for. */
  private static readonly MAX_SEEN = 10;
  /**
   * How long a stop made here stands without the routing map carrying it. Long enough for the report to
   * be recorded and the map refetched; after it, an address the map no longer lists was released.
   */
  static readonly UNRECORDED_GRACE_MS = 2 * 60_000;

  private readonly visitors = new Map<string, { firstAt: number; strikes: number; bannedUntil: number; bannedAt: number; hosts: string[]; paths: string[] }>();

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
   * turns stopping off. `host` and `path` are what the refused request asked for.
   */
  strike(address: string | undefined, after: number, minutes: number, host = '', path = ''): boolean {
    if (!(after > 0) || !(minutes > 0)) return false;
    const visitor = GatewayScannerBan.visitorOf(address);
    if (!visitor) return false;
    const now = this.now();
    let entry = this.visitors.get(visitor);
    // A ban that has run out starts the count again, as does a window that has passed.
    const expired = entry !== undefined && entry.bannedUntil > 0 && entry.bannedUntil <= now;
    if (!entry || expired || (entry.bannedUntil === 0 && now - entry.firstAt >= GatewayScannerBan.WINDOW_MS)) {
      entry = { firstAt: now, strikes: 0, bannedUntil: 0, bannedAt: 0, hosts: [], paths: [] };
    }
    this.visitors.delete(visitor);
    this.visitors.set(visitor, entry);
    this.forgetOldest();
    entry.strikes += 1;
    GatewayScannerBan.remember(entry.hosts, host);
    GatewayScannerBan.remember(entry.paths, path);
    if (entry.strikes < after || entry.bannedUntil > now) return false;
    entry.bannedUntil = now + minutes * 60_000;
    entry.bannedAt = now;
    return true;
  }

  /** What the console shows about a stop just made: until when, how many refusals, what it asked for. */
  describe(address: string | undefined): { address: string; until: string; strikes: number; hosts: string[]; paths: string[] } | null {
    const visitor = GatewayScannerBan.visitorOf(address);
    const entry = visitor ? this.visitors.get(visitor) : undefined;
    if (!visitor || !entry || entry.bannedUntil <= this.now()) return null;
    return { address: visitor, until: new Date(entry.bannedUntil).toISOString(), strikes: entry.strikes, hosts: [...entry.hosts], paths: [...entry.paths] };
  }

  /**
   * The recorded stops, from the routing map. Each listed address is stopped until its end; a stop made
   * here that the map no longer lists, once past {@link UNRECORDED_GRACE_MS}, was released and ends now.
   */
  sync(stops: readonly EdgeStop[]): void {
    const now = this.now();
    const listed = new Map<string, number>();
    for (const stop of stops) {
      const visitor = GatewayScannerBan.visitorOf(stop.address);
      if (visitor && stop.until > now) listed.set(visitor, stop.until);
    }
    for (const [visitor, entry] of this.visitors) {
      if (entry.bannedUntil <= now || listed.has(visitor)) continue;
      if (now - entry.bannedAt >= GatewayScannerBan.UNRECORDED_GRACE_MS) {
        entry.bannedUntil = 0;
        entry.strikes = 0;
        entry.firstAt = now;
      }
    }
    for (const [visitor, until] of listed) {
      const entry = this.visitors.get(visitor) ?? { firstAt: now, strikes: 0, bannedUntil: 0, bannedAt: now, hosts: [], paths: [] };
      entry.bannedUntil = until;
      if (!this.visitors.has(visitor)) this.visitors.set(visitor, entry);
    }
    this.forgetOldest();
  }

  private static remember(list: string[], value: string): void {
    const clean = String(value || '').slice(0, 200);
    if (clean && !list.includes(clean) && list.length < GatewayScannerBan.MAX_SEEN) list.push(clean);
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

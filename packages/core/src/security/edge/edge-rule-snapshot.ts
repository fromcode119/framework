import { createHash } from 'crypto';
import { EdgeStop } from '@core/security/edge/edge-stop';
import { NetworkAddressUtils } from '@core/security/network-address-utils';
import type { TenantRouteMap } from '@core/tenant/tenant-route-map';

/**
 * What an edge refuses at connect, before a single byte reaches a site: the addresses refused on EVERY
 * site. The edge sees only an address (and on 443 not even the host), so a rule for one site stays with
 * the gateway; what the edge takes is what holds everywhere:
 *
 * - the stopped addresses (Settings → Security → Stopped addresses), refused on every site by definition;
 * - the addresses in every site's effective "Blocked addresses" (Settings → Security → Edge protection).
 *
 * `version` names the content, not the moment: two gateways with the same rules give the same version,
 * so an edge that switches between them during a deploy fetches nothing twice, and one that comes back
 * knows at once whether what it kept on disk is still current. Each end applies `until` itself, so a
 * stop ends on time even on an edge cut off from the platform.
 */
export class EdgeRuleSnapshot {
  constructor(
    readonly stops: readonly EdgeStop[],
    readonly blocked: readonly string[],
    readonly version: string,
    readonly generatedAt: number,
  ) {}

  static of(stops: readonly EdgeStop[], blocked: readonly string[], now: number): EdgeRuleSnapshot {
    const liveStops = [...stops].filter((stop) => stop.until > now).sort((a, b) => a.address.localeCompare(b.address) || a.until - b.until);
    const list = [...new Set(blocked.map((entry) => String(entry).trim()).filter(Boolean))].sort();
    const version = createHash('sha256').update(JSON.stringify([liveStops.map((stop) => [stop.address, stop.until]), list])).digest('hex').slice(0, 32);
    return new EdgeRuleSnapshot(liveStops, list, version, now);
  }

  /** The rules in a routing map that hold on every site. */
  static fromMap(map: TenantRouteMap, now: number): EdgeRuleSnapshot {
    const tenants = map.routedTenants();
    const sets = (tenants.length ? tenants : [null]).map((tenant) => new Set(map.protection.rulesFor(tenant).blockedAddresses));
    const everywhere = [...sets[0]].filter((entry) => sets.every((set) => set.has(entry)));
    return EdgeRuleSnapshot.of(map.stops, everywhere, now);
  }

  /** Whether `address` is refused at `now`. */
  refuses(address: string, now: number): boolean {
    const normalized = NetworkAddressUtils.normalize(address);
    if (this.stops.some((stop) => stop.address === normalized && stop.until > now)) return true;
    return NetworkAddressUtils.matchesAny(normalized, this.blocked);
  }

  toJSON(): Record<string, unknown> {
    return { version: this.version, generatedAt: new Date(this.generatedAt).toISOString(), stops: this.stops.map((stop) => stop.toJSON()), blocked: [...this.blocked] };
  }

  /** A snapshot as sent or kept on disk, or null when it is not one. Its version is recomputed, never trusted. */
  static fromJson(raw: unknown): EdgeRuleSnapshot | null {
    const value = (raw ?? null) as Record<string, unknown> | null;
    if (!value || !Array.isArray(value.stops) || !Array.isArray(value.blocked)) return null;
    const generatedAt = Date.parse(String(value.generatedAt ?? ''));
    return EdgeRuleSnapshot.of(EdgeStop.listFromJson(value.stops), value.blocked.map(String), Number.isFinite(generatedAt) ? generatedAt : 0);
  }
}

import { GatewayTarget } from '@core/tenant/gateway-target';
import { EdgeProtection } from '@core/security/edge/edge-protection';
import { TenantHostRole } from '@core/tenant/tenant-host-role';
import { TenantRoute } from '@core/tenant/tenant-route';
import type { TenantRecord } from '@core/tenant/tenant-record';

/**
 * Host → app, derived from the tenant table and nothing else (T6 §3.1).
 * - a site's hosts → frontend; a workspace's hosts → admin;
 * - any `api.` alias → api, whatever the kind (device and app traffic);
 * - the platform's own hosts (admin, api, frontend) are passed in by the deployment.
 * Suspended tenants are still routed: the app answers 503 with the reason, which a 404 at the edge
 * would hide. An unknown host is simply absent — the gateway answers 404, fail-closed.
 */
export class TenantRouteMap {
  private readonly byHost = new Map<string, TenantRoute>();
  /**
   * This deployment has never been set up, so the gateway must let SOMEBODY in to do it.
   *
   * Carried on the map because the map is what the gateway already fetches and caches; a second
   * endpoint would be a second thing to keep in step. Decided at boot by `SetupMode` — never here.
   */
  readonly setup: boolean;
  /**
   * The relays in front of the platform whose PROXY header the gateway believes (Settings → Security →
   * Trusted relays). Carried here for the same reason as `setup`: the map is what the gateway fetches.
   */
  readonly relays: readonly string[];
  /** What the gateway enforces in front of each site (Settings → Security → Edge protection). */
  readonly protection: EdgeProtection;

  constructor(routes: Iterable<TenantRoute>, setup = false, relays: readonly string[] = [], protection: EdgeProtection = EdgeProtection.NONE) {
    for (const route of routes) this.byHost.set(route.host, route);
    this.setup = setup === true;
    this.relays = [...relays];
    this.protection = protection;
  }

  /** This map, with the relays the operator declared. */
  withRelays(relays: readonly string[]): TenantRouteMap {
    return new TenantRouteMap(this.byHost.values(), this.setup, relays, this.protection);
  }

  /** This map, with the edge protection the operator set. */
  withProtection(protection: EdgeProtection): TenantRouteMap {
    return new TenantRouteMap(this.byHost.values(), this.setup, this.relays, protection);
  }

  static build(tenants: readonly TenantRecord[], platform: { admin?: string; api?: string; frontend?: string }, setup = false): TenantRouteMap {
    const routes: TenantRoute[] = [];
    const platformHost = (value: string | undefined, target: GatewayTarget, consolePath = '') => {
      const host = TenantRouteMap.hostOf(value);
      if (host) routes.push(new TenantRoute(host, target, null, consolePath));
    };
    // The console on a PATH of the frontend's own host (`shop.com` + `shop.com/admin`). A host belongs
    // to one app, so a second route for the same host would replace the first and the console would
    // vanish behind the storefront. The frontend route carries the console path instead — the same
    // mount a site's "Console path" uses.
    const adminHost = TenantRouteMap.hostOf(platform.admin);
    const consolePath = adminHost && adminHost === TenantRouteMap.hostOf(platform.frontend) ? TenantRouteMap.pathOf(platform.admin) : '';
    if (!consolePath) platformHost(platform.admin, GatewayTarget.ADMIN);
    platformHost(platform.api, GatewayTarget.API);
    platformHost(platform.frontend, GatewayTarget.FRONTEND, consolePath);
    for (const tenant of tenants) {
      for (const host of tenant.hosts()) {
        // The DECLARED role, never the hostname. A host used to become the api by starting with
        // `api.`, so a shop alias called `api.shop.com` silently stopped serving the shop with
        // nothing on any screen saying so. `roleFor` answers from what the operator set, falling
        // back to the tenant's own kind.
        const target = TenantRouteMap.targetFor(tenant.roleFor(host));
        // A storefront host may also carry the tenant's console on a path the operator chose.
        const consolePath = target === GatewayTarget.FRONTEND ? tenant.consolePath : '';
        routes.push(new TenantRoute(host, target, tenant.id, consolePath));
      }
    }
    return new TenantRouteMap(routes, setup);
  }

  /** One declared role, as the upstream the gateway proxies to. */
  private static targetFor(role: TenantHostRole): GatewayTarget {
    if (role === TenantHostRole.API) return GatewayTarget.API;
    if (role === TenantHostRole.ADMIN) return GatewayTarget.ADMIN;
    return GatewayTarget.FRONTEND;
  }

  static fromJson(raw: unknown): TenantRouteMap {
    const list = Array.isArray((raw as any)?.routes) ? (raw as any).routes : [];
    return new TenantRouteMap(
      list.map((entry: unknown) => TenantRoute.from(entry)).filter((route: TenantRoute | null): route is TenantRoute => route !== null),
      (raw as any)?.setup === true,
      Array.isArray((raw as any)?.relays) ? (raw as any).relays.map((entry: unknown) => String(entry)) : [],
      EdgeProtection.fromJson((raw as any)?.protection),
    );
  }

  resolve(host: string): TenantRoute | undefined {
    return this.byHost.get(String(host ?? '').trim().toLowerCase().replace(/:\d+$/, ''));
  }

  get size(): number {
    return this.byHost.size;
  }

  /** One host for each site the frontend serves — what a new frontend renders once before it takes visitors. */
  siteHosts(): string[] {
    const bySite = new Map<string, string>();
    for (const route of this.byHost.values()) {
      if (route.tenantId && route.target === GatewayTarget.FRONTEND && !bySite.has(route.tenantId)) bySite.set(route.tenantId, route.host);
    }
    return [...bySite.values()];
  }

  toJSON(): Record<string, unknown> {
    return { routes: [...this.byHost.values()].map((route) => route.toJSON()), setup: this.setup, relays: [...this.relays], protection: this.protection.toJSON() };
  }

  /** A public app URL or bare host → bare host. */
  /** The URL's path without a trailing slash (`/admin`), or `''` for the root. */
  private static pathOf(value: string | undefined): string {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    try { return new URL(raw.includes('://') ? raw : `http://${raw}`).pathname.replace(/\/+$/, ''); } catch { return ''; }
  }

  private static hostOf(value: string | undefined): string {
    const raw = String(value ?? '').trim().toLowerCase();
    if (!raw) return '';
    try { return new URL(raw.includes('://') ? raw : `http://${raw}`).host.replace(/:\d+$/, ''); } catch { return ''; }
  }
}

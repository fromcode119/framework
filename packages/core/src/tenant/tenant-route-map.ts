import { GatewayTarget } from '@core/tenant/gateway-target';
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

  constructor(routes: Iterable<TenantRoute>) {
    for (const route of routes) this.byHost.set(route.host, route);
  }

  static build(tenants: readonly TenantRecord[], platform: { admin?: string; api?: string; frontend?: string }): TenantRouteMap {
    const routes: TenantRoute[] = [];
    const platformHost = (value: string | undefined, target: GatewayTarget) => {
      const host = TenantRouteMap.hostOf(value);
      if (host) routes.push(new TenantRoute(host, target, null));
    };
    platformHost(platform.admin, GatewayTarget.ADMIN);
    platformHost(platform.api, GatewayTarget.API);
    platformHost(platform.frontend, GatewayTarget.FRONTEND);
    for (const tenant of tenants) {
      for (const host of tenant.hosts()) {
        const target = host.startsWith('api.') ? GatewayTarget.API : (tenant.isWorkspace ? GatewayTarget.ADMIN : GatewayTarget.FRONTEND);
        routes.push(new TenantRoute(host, target, tenant.id));
      }
    }
    return new TenantRouteMap(routes);
  }

  static fromJson(raw: unknown): TenantRouteMap {
    const list = Array.isArray((raw as any)?.routes) ? (raw as any).routes : [];
    return new TenantRouteMap(list.map((entry: unknown) => TenantRoute.from(entry)).filter((route: TenantRoute | null): route is TenantRoute => route !== null));
  }

  resolve(host: string): TenantRoute | undefined {
    return this.byHost.get(String(host ?? '').trim().toLowerCase().replace(/:\d+$/, ''));
  }

  get size(): number {
    return this.byHost.size;
  }

  toJSON(): Record<string, unknown> {
    return { routes: [...this.byHost.values()].map((route) => route.toJSON()) };
  }

  /** A public app URL or bare host → bare host. */
  private static hostOf(value: string | undefined): string {
    const raw = String(value ?? '').trim().toLowerCase();
    if (!raw) return '';
    try { return new URL(raw.includes('://') ? raw : `http://${raw}`).host.replace(/:\d+$/, ''); } catch { return ''; }
  }
}

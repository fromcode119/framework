import { GatewayTarget, RequestSurfaceUtils, TenantRouteMap } from '@fromcode119/core';

/**
 * Which app answers a request — the gateway's routing rules, kept apart from its sockets so they can
 * be tested as plain functions. `PlatformGateway` resolves the host and calls in here.
 */
export class GatewayRouteRules {
  /** Pure routing rule, testable without sockets: map by host first, path rules when there is no map. */
  static resolveTarget(map: TenantRouteMap | null, host: string, pathname: string, targets: Record<string, string>): string | null {
    if (map) {
      // NOT YET SET UP: no tenants and no admin domain, so there is no host to recognise and the
      // fail-closed 404 below would leave a fresh install with no host that answers at all. While
      // that is true — and `SetupMode` decides it once at boot, from an empty database, on a timer —
      // any host falls through to the SAME path rules a deployment without a routing map uses. It is
      // not a new routing rule, just the existing one applied for as long as nobody has claimed this
      // platform. The api refuses the setup endpoint itself once the window closes or someone else
      // claims it; the gateway only decides who gets to ask.
      if (map.setup) return GatewayRouteRules.resolveForSetup(pathname, targets);

      const route = map.resolve(host);
      if (!route) return null;
      // An app host — a workspace console OR a site's storefront — calls the api on ITS OWN origin
      // (`/api/*`, uploads, plugin and theme assets): same site, so its session cookie and CORS need
      // nothing special, and the api reads the tenant from the Host. That last part is the point: on a
      // multi-site deployment the host is the only thing that says WHICH site a call belongs to, and a
      // storefront sent to one shared api host loses it — the courier integration then read the
      // platform-level record instead of the shop's. Only these paths; the app owns `/media`,
      // `/plugins/<slug>/settings` and every storefront page.
      if (RequestSurfaceUtils.isApiPathOnAppHost(pathname)) return targets[GatewayTarget.API.value] || null;
      return targets[route.target.value] || null;
    }
    return GatewayRouteRules.resolveByPath(pathname, targets);
  }

  /**
   * While nobody has claimed this platform, every host leads to the CONSOLE.
   *
   * Not the generic path rule: that sends `/` to the frontend, and during setup there are no sites —
   * the operator would open the host they were given and land on nothing at all. The only two
   * things that can usefully answer yet are the wizard and the api it posts to.
   */
  private static resolveForSetup(pathname: string, targets: Record<string, string>): string | null {
    if (RequestSurfaceUtils.isApiPath(pathname)) return targets[GatewayTarget.API.value] || null;
    return targets[GatewayTarget.ADMIN.value] || null;
  }

  /** The single-domain rule: decide by PATH, because no host here means anything yet. */
  private static resolveByPath(pathname: string, targets: Record<string, string>): string | null {
    if (RequestSurfaceUtils.isApiPath(pathname)) return targets[GatewayTarget.API.value];
    if (RequestSurfaceUtils.isAdminPath(pathname)) return targets[GatewayTarget.ADMIN.value];
    if (targets[GatewayTarget.FRONTEND.value]) return targets[GatewayTarget.FRONTEND.value];
    if (pathname === '/' || pathname.startsWith('/?')) return targets[GatewayTarget.API.value];
    return targets[GatewayTarget.ADMIN.value];
  }
}

import http from 'http';
import httpProxy from 'http-proxy';
import { ApiPathUtils, GatewayTarget, InternalServiceAuth, RequestSurfaceUtils, RouteConstants, TenantRouteMap } from '@fromcode119/core';
import { RoutingMapClient } from '@cli/services/routing-map-client';

/**
 * The platform's own edge (T6 §3.1): the ONE upstream the TLS terminator forwards every host to.
 *
 * Routes by HOST from the tenant table (via RoutingMapClient): a site's hosts → frontend, a
 * workspace's hosts → admin, any `api.` alias → api, the platform's own hosts as configured. A host
 * nobody owns is answered 404 here — fail-closed, the same rule the api applies. When no routing map
 * is configured (no internal secret) it routes by PATH within one domain, exactly as the
 * single-domain gateway always did, so an existing deployment behaves as before.
 *
 * The original Host header is kept and repeated as `X-Forwarded-Host`, which is what the apps'
 * tenancy reads first. WebSockets route the same way.
 */
export class PlatformGateway {
  static readonly RELOAD_PATH = RouteConstants.SEGMENTS.INTERNAL_ROUTING_RELOAD;
  static readonly HEALTH_PATH = RouteConstants.SEGMENTS.GATEWAY_HEALTH;
  /** The api's routing map, on the api's versioned base — the one place a version is composed here. */
  static readonly ROUTING_PATH = ApiPathUtils.versioned(RouteConstants.SEGMENTS.INTERNAL_ROUTING);
  private static readonly DEFAULT_PORT = 3000;

  private readonly proxy = httpProxy.createProxyServer({ ws: true, xfwd: true });
  private readonly port = PlatformGateway.readPort();
  private readonly targets: Record<string, string> = {
    [GatewayTarget.API.value]: process.env.API_TARGET_URL || 'http://api:3000',
    [GatewayTarget.ADMIN.value]: process.env.ADMIN_TARGET_URL || 'http://admin:3000',
    [GatewayTarget.FRONTEND.value]: String(process.env.FRONTEND_TARGET_URL || '').trim(),
  };

  constructor(private readonly routing: RoutingMapClient = new RoutingMapClient(`${process.env.API_TARGET_URL || 'http://api:3000'}${PlatformGateway.ROUTING_PATH}`)) {}

  start(): void {
    this.proxy.on('error', (error, _req, res) => {
      console.error('[platform-gateway] proxy error:', error.message);
      if (res && 'writeHead' in res && typeof res.writeHead === 'function' && !res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Service unavailable - is the target process running?');
      }
    });
    this.proxy.on('proxyReq', (proxyReq, req) => {
      const host = String(req.headers.host || '');
      if (host && !proxyReq.getHeader('x-forwarded-host')) proxyReq.setHeader('x-forwarded-host', host);
    });

    const server = http.createServer((req, res) => { void this.handle(req, res); });
    server.on('upgrade', (req, socket, head) => {
      void this.targetFor(req).then((target) => {
        if (!target) { socket.destroy(); return; }
        this.proxy.ws(req, socket, head, { target });
      });
    });
    server.listen(this.port, () => {
      void this.routing.refresh().then(() => this.logStartup());
    });
  }

  private async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = req.url || '/';
    if (url === PlatformGateway.HEALTH_PATH) return this.health(res);
    if (url === PlatformGateway.RELOAD_PATH && req.method === 'POST') return this.reload(req, res);
    const target = await this.targetFor(req);
    if (!target) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'unknown_host', host: PlatformGateway.hostOf(req) }));
      return;
    }
    this.proxy.web(req, res, { target });
  }

  /** The upstream for this request, or null for a host the platform does not serve. */
  async targetFor(req: http.IncomingMessage): Promise<string | null> {
    const map = await this.routing.resolveMap();
    return PlatformGateway.resolveTarget(map, PlatformGateway.hostOf(req), req.url || '/', this.targets);
  }

  /** Pure routing rule, testable without sockets: map by host first, path rules when there is no map. */
  static resolveTarget(map: TenantRouteMap | null, host: string, pathname: string, targets: Record<string, string>): string | null {
    if (map) {
      const route = map.resolve(host);
      if (!route) return null;
      // A workspace console calls the api on ITS OWN origin (`/api/*`, uploads, plugin and theme
      // assets): same site, so its session cookie and CORS need nothing special, and the api reads the
      // workspace from the Host. Only those paths — the admin owns `/media`, `/plugins/<slug>/settings`
      // and the rest. A site's storefront keeps proxying its api paths itself (frontend `/api` route).
      if (route.target === GatewayTarget.ADMIN && RequestSurfaceUtils.isApiPathOnAdminHost(pathname)) return targets[GatewayTarget.API.value] || null;
      return targets[route.target.value] || null;
    }
    if (RequestSurfaceUtils.isApiPath(pathname)) return targets[GatewayTarget.API.value];
    if (RequestSurfaceUtils.isAdminPath(pathname)) return targets[GatewayTarget.ADMIN.value];
    if (targets[GatewayTarget.FRONTEND.value]) return targets[GatewayTarget.FRONTEND.value];
    if (pathname === '/' || pathname.startsWith('/?')) return targets[GatewayTarget.API.value];
    return targets[GatewayTarget.ADMIN.value];
  }

  private async reload(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    if (!InternalServiceAuth.authorize(req.headers[InternalServiceAuth.HEADER])) {
      res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'internal_secret_required' }));
      return;
    }
    const map = await this.routing.refresh();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, hosts: map?.size ?? 0 }));
  }

  private health(res: http.ServerResponse): void {
    const map = this.routing.current;
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, mode: this.routing.enabled ? 'host-routing' : 'single-domain', hosts: map?.size ?? 0, mapAgeMs: this.routing.ageMs, targets: this.targets }));
  }

  private logStartup(): void {
    const map = this.routing.current;
    console.log(`[platform-gateway] listening on http://0.0.0.0:${this.port} mode=${this.routing.enabled ? 'host-routing' : 'single-domain'} hosts=${map?.size ?? 0}`);
    for (const [name, target] of Object.entries(this.targets)) if (target) console.log(`[platform-gateway]   ${name} → ${target}`);
  }

  private static hostOf(req: http.IncomingMessage): string {
    return String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim().toLowerCase().replace(/:\d+$/, '');
  }

  private static readPort(): number {
    const parsed = Number.parseInt(String(process.env.PORT || PlatformGateway.DEFAULT_PORT), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : PlatformGateway.DEFAULT_PORT;
  }
}

import http from 'http';
import { GatewayRetryPolicy } from '@cli/services/gateway-retry-policy';
import { RefusedAddressLookup } from '@cli/services/refused-address-lookup';
import { Duplex } from 'stream';
import httpProxy from 'http-proxy';
import { ApiPathUtils, GatewayTarget, InternalServiceAuth, RouteConstants } from '@fromcode119/core';
import { CertificateBundleClient } from '@cli/services/certificate-bundle-client';
import { GatewayPlainListenerPolicy } from '@cli/services/gateway-plain-listener-policy';
import { GatewayTlsListener } from '@cli/services/gateway-tls-listener';
import { GatewayHttp2Adapter } from '@cli/services/gateway/gateway-http2-adapter';
import { GatewayListener } from '@cli/services/gateway/gateway-listener';
import { RoutingMapClient } from '@cli/services/routing-map-client';
import { GatewayEdgeCheck } from '@cli/services/gateway/challenge/gateway-edge-check';
import { GatewayApiHostPath } from '@cli/services/gateway/gateway-api-host-path';
import { GatewayConsoleMount } from '@cli/services/gateway/gateway-console-mount';
import { GatewayRouteRules } from '@cli/services/gateway/gateway-route-rules';

/**
 * The platform's own edge (T6 §3.1): the ONE upstream the TLS terminator forwards every host to.
 *
 * Routes by HOST from the tenant table (via RoutingMapClient): a site's hosts → frontend, a
 * workspace's hosts → admin, any `api.` alias → api, the platform's own hosts as configured. NONE of
 * that is decided here — `TenantRouteMap.build` owns every one of those rules, including the `api.`
 * alias, and this class only looks up the answer. Reading it as gateway behaviour sends you hunting
 * for alias handling in this file that was never in it.
 *
 * A host nobody owns is answered 404 here — fail-closed, the same rule the api applies, and it is the
 * gateway's 404 rather than the api's: the request never reaches the api at all, though both use the
 * same `{"error":"unknown_host"}` body, so check WHICH process answered before concluding the api
 * refused something. When no routing map is configured (no internal secret) it routes by PATH within
 * one domain, exactly as the single-domain gateway always did, so an existing deployment behaves as
 * before — meaning which component serves `/api` is NOT the same in both modes.
 *
 * The original Host header is kept and repeated as `X-Forwarded-Host`, which is what the apps'
 * tenancy reads first. WebSockets route the same way.
 */
export class PlatformGateway {
  static readonly RELOAD_PATH = RouteConstants.SEGMENTS.INTERNAL_ROUTING_RELOAD;
  static readonly HEALTH_PATH = RouteConstants.SEGMENTS.GATEWAY_HEALTH;
  /** The api's routing map, on the api's versioned base — the one place a version is composed here. */
  static readonly ROUTING_PATH = ApiPathUtils.versioned(RouteConstants.SEGMENTS.INTERNAL_ROUTING);
  /** The api's certificates, on the same versioned base. Only fetched when TLS termination is on. */
  static readonly CERTIFICATES_PATH = ApiPathUtils.versioned(RouteConstants.SEGMENTS.INTERNAL_CERTIFICATES);
  private static readonly DEFAULT_PORT = 3000;
  /** How long a stopping gateway lets requests in flight finish; under `RollingDeploy.STOP_GRACE_SECONDS`. */
  static readonly STOP_GRACE_MS = 25_000;

  /**
   * One pooled connection set to each app instead of a fresh socket per request. Without it every
   * proxied call opened and closed its own connection, and a burst from ONE page load answered
   * `Parse Error: Data after 'Connection: close'`.
   */
  private readonly addresses = new RefusedAddressLookup();
  private readonly agent = new http.Agent({ keepAlive: true, maxSockets: 256, maxFreeSockets: 32, lookup: this.addresses.lookup } as http.AgentOptions);

  private readonly proxy = httpProxy.createProxyServer({ ws: true, xfwd: true, agent: this.agent });
  private readonly retries = new GatewayRetryPolicy();
  private readonly targetOf = new WeakMap<http.IncomingMessage, string>(); // where a retry goes
  private readonly mountOf = new WeakMap<http.IncomingMessage, string>(); // a console on a site path
  private readonly port = PlatformGateway.readPort();
  private readonly targets: Record<string, string> = {
    [GatewayTarget.API.value]: process.env.API_TARGET_URL || 'http://api:3000',
    [GatewayTarget.ADMIN.value]: process.env.ADMIN_TARGET_URL || 'http://admin:3000',
    [GatewayTarget.FRONTEND.value]: String(process.env.FRONTEND_TARGET_URL || '').trim(),
  };

  /** The listening server, so a caller (and the tests) can reach and close it. */
  server: http.Server | null = null;
  /** Accepts for `server`: reads the PROXY header from `edge`, and stops gracefully. */
  listener: GatewayListener | null = null;
  /**
   * TLS termination, when this deployment asked for it. Null is the default and means the gateway
   * behaves exactly as it always has: something in front of it holds the certificates.
   */
  private readonly tlsPort = GatewayTlsListener.readPort();
  private readonly certificates = new CertificateBundleClient(`${process.env.API_TARGET_URL || 'http://api:3000'}${PlatformGateway.CERTIFICATES_PATH}`);
  private readonly edge = new GatewayEdgeCheck(() => this.routing.resolveMap(), (req) => PlatformGateway.hostOf(req));
  private readonly tls: GatewayTlsListener | null = this.tlsPort === null ? null : new GatewayTlsListener(this.tlsPort, this.certificates, () => this.routing.current?.relays ?? []);
  private readonly plainPolicy = new GatewayPlainListenerPolicy(this.tlsPort !== null);

  constructor(private readonly routing: RoutingMapClient = new RoutingMapClient(`${process.env.API_TARGET_URL || 'http://api:3000'}${PlatformGateway.ROUTING_PATH}`)) {}

  start(): void {
    this.proxy.on('error', (error, req, res) => {
      const target = this.targetOf.get(req);
      this.addresses.noteRefused(error as NodeJS.ErrnoException);
      if (target && this.retries.allows(error as NodeJS.ErrnoException, req, res)) {
        this.proxy.web(req, res as http.ServerResponse, { target });
        return;
      }
      console.error('[platform-gateway] proxy error:', error.message);
      if (!res || !('writeHead' in res) || typeof res.writeHead !== 'function') return;
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Service unavailable - is the target process running?');
        return;
      }
      // The response is already on the wire, so there is nothing to say — cut it, or the upstream keeps
      // writing into a finished response.
      res.destroy();
    });
    this.proxy.on('proxyRes', (proxyRes, req) => {
      const mount = this.mountOf.get(req);
      if (mount && proxyRes.headers.location) proxyRes.headers.location = GatewayConsoleMount.rewriteLocation(proxyRes.headers.location, mount, PlatformGateway.hostOf(req));
      GatewayHttp2Adapter.toHttp2(proxyRes, req);
    });
    this.proxy.on('proxyReq', (proxyReq, req) => {
      const host = String(req.headers.host || '');
      if (host && !proxyReq.getHeader('x-forwarded-host')) proxyReq.setHeader('x-forwarded-host', host);
    });

    const server = http.createServer((req, res) => {
      // A connection that goes away mid-response leaves the upstream still writing into a response that
      // has ended. With no listener, Node turns that into an UNHANDLED 'error' and the process exits —
      // so one aborted request took the whole edge down and every site answered 502 until it restarted.
      res.on('error', (error: Error) => console.warn('[platform-gateway] response error:', error.message));
      req.on('error', (error: Error) => console.warn('[platform-gateway] request error:', error.message));
      void this.handlePlain(req, res);
    });
    server.on('clientError', (error: Error, socket) => {
      console.warn('[platform-gateway] client error:', error.message);
      socket.destroy();
    });
    server.on('upgrade', (req, socket, head) => { this.upgrade(req, socket, head); });
    this.server = server;
    this.listener = new GatewayListener(server, undefined, () => this.routing.current?.relays ?? []); // Trusted relays
    this.listener.listen(this.port, () => {
      void this.routing.refresh().then(() => this.logStartup());
    });

    // Only when this deployment asked for it. The TLS listener serves the SAME handler, so a request
    // is routed identically however it arrived — the only difference is which socket it came in on.
    if (this.tls) {
      this.tls.start({
        request: (req, res) => { void this.handle(req, res); },
        upgrade: (req, socket, head) => { this.upgrade(req, socket, head); },
      });
      void this.certificates.refresh();
    }
  }

  /**
   * Stops gracefully: accepts nothing more, lets what is in flight finish (up to `graceMs`). `edge`
   * sends new connections to the gateway replacing this one, so a deploy fails no request.
   */
  async stop(graceMs: number): Promise<void> {
    await Promise.all([this.listener?.stop(graceMs), this.tls?.stop(graceMs)]);
    this.agent.destroy();
  }

  private upgrade(req: http.IncomingMessage, socket: Duplex, head: Buffer): void {
    void this.targetFor(req).then(async (target) => {
      if (!target || !(await this.edge.allowsUpgrade(req))) { socket.destroy(); return; }
      this.proxy.ws(req, socket, head, { target });
    });
  }

  /**
   * A request that arrived over plain HTTP.
   *
   * Once this gateway holds the certificates, plain HTTP is only a signpost to HTTPS. Health and the
   * reload push stay reachable on it: both are internal calls on the container network, and sending
   * a monitoring check or the api's own push through a redirect would break them for no benefit.
   */
  private async handlePlain(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = req.url || '/';
    const internal = url === PlatformGateway.HEALTH_PATH || url === PlatformGateway.RELOAD_PATH;
    const redirect = internal ? null : this.plainPolicy.redirectFor(req);
    if (redirect) {
      res.writeHead(301, { Location: redirect, 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Use HTTPS.');
      return;
    }
    return this.handle(req, res);
  }

  private async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = req.url || '/';
    if (url === PlatformGateway.HEALTH_PATH) return this.health(res);
    if (url === PlatformGateway.RELOAD_PATH && req.method === 'POST') return this.reload(req, res);
    // A certificate authority proving a host is ours, before that host has a certificate — and
    // therefore before it has a route. Answered for ANY hostname, including one the routing map has
    // never heard of: at this point in a domain's life it legitimately has not been set up yet.
    if (GatewayPlainListenerPolicy.isChallengePath(url)) {
      const api = this.targets[GatewayTarget.API.value];
      if (api) { this.forward(req, res, api); return; }
    }
    if (await this.edge.handle(req, res)) return; // Settings → Security → Edge protection
    const target = await this.targetFor(req);
    if (!target) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'unknown_host', host: PlatformGateway.hostOf(req) }));
      return;
    }
    this.forward(req, res, target);
  }

  private forward(req: http.IncomingMessage, res: http.ServerResponse, target: string): void {
    this.targetOf.set(req, target);
    this.proxy.web(req, res, { target });
  }

  /**
   * The upstream for this request, or null for an unknown host. An api host's root path is put under
   * the api base; a site's console path is removed and named to the admin in a header.
   */
  async targetFor(req: http.IncomingMessage): Promise<string | null> {
    const map = await this.routing.resolveMap();
    const host = PlatformGateway.hostOf(req);
    req.url = GatewayApiHostPath.upstream(map, host, req.url || '/');
    const mounted = GatewayConsoleMount.resolve(map, host, req.url);
    GatewayConsoleMount.applyHeader(req, mounted?.mount ?? null);
    if (!mounted) return GatewayRouteRules.resolveTarget(map, host, req.url, this.targets);
    this.mountOf.set(req, mounted.mount);
    req.url = mounted.url;
    return GatewayConsoleMount.targetFor(mounted, this.targets);
  }

  private async reload(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    if (!InternalServiceAuth.authorize(req.headers[InternalServiceAuth.HEADER])) {
      res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'internal_secret_required' }));
      return;
    }
    // ONE reload refreshes routing AND certificates. There is deliberately no second endpoint: two
    // signals that can disagree about which half changed is harder to keep correct than one that
    // always refreshes both, and an upload changes what this process must serve just as a tenant
    // change does.
    const [map, bundle] = await Promise.all([
      this.routing.refresh(),
      this.tls ? this.certificates.refresh() : Promise.resolve(null),
    ]);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, hosts: map?.size ?? 0, certificates: bundle?.size ?? 0 }));
  }

  private health(res: http.ServerResponse): void {
    const map = this.routing.current;
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: true,
      mode: this.routing.enabled ? 'host-routing' : 'single-domain',
      hosts: map?.size ?? 0,
      mapAgeMs: this.routing.ageMs,
      targets: this.targets,
      // The admin shows these verbatim rather than implying that storing a certificate served it.
      tls: this.tls !== null,
      certificates: this.tls?.size ?? 0,
      certificatesAgeMs: this.certificates.ageMs,
    }));
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
    // 0 is a real answer — "any free port" — and rejecting it sent a test gateway onto the live 3000.
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : PlatformGateway.DEFAULT_PORT;
  }
}

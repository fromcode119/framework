import http from 'http';
import { NetworkAddressUtils } from '@fromcode119/core';
import type { TenantRouteMap } from '@fromcode119/core';
import { GatewayChallenge } from '@cli/services/gateway/challenge/gateway-challenge';
import { GatewayRateLimit } from '@cli/services/gateway/challenge/gateway-rate-limit';
import { GatewayAttackFilter } from '@cli/services/gateway/challenge/gateway-attack-filter';
import { GatewayVisitorRules } from '@cli/services/gateway/challenge/gateway-visitor-rules';
import { GatewayRefusalLog } from '@cli/services/gateway/challenge/gateway-refusal-log';
import { GatewayScannerBan } from '@cli/services/gateway/challenge/gateway-scanner-ban';
import { GatewayEdgeReporter } from '@cli/services/gateway/challenge/gateway-edge-reporter';

/**
 * Settings → Security → Edge protection, applied by the gateway before it routes: the request's
 * host names its site, and a site under attack mode checks the browser first (`GatewayChallenge`).
 * A host the routing map does not know is left to the gateway's own 404.
 */
export class GatewayEdgeCheck {
  /** The reason logged and returned for an address stopped as a scanner. */
  static readonly SCANNER = 'scanner_stopped';

  constructor(
    /** The gateway's current routing map (it carries the protection settings). */
    private readonly routingMap: () => Promise<TenantRouteMap | null>,
    private readonly hostOf: (req: http.IncomingMessage) => string,
    private readonly challenge: GatewayChallenge = new GatewayChallenge(),
    private readonly limit: GatewayRateLimit = new GatewayRateLimit(),
    private readonly visitors: GatewayVisitorRules = new GatewayVisitorRules(),
    private readonly refusals: GatewayRefusalLog = new GatewayRefusalLog(),
    private readonly scanners: GatewayScannerBan = new GatewayScannerBan(),
    private readonly reporter: GatewayEdgeReporter = new GatewayEdgeReporter(),
  ) {}

  /** The map whose stops were last applied, so each fetched map is applied once. */
  private synced: TenantRouteMap | null = null;

  /** True when the check answered the request itself: an attack, too many requests, or the browser check. */
  async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<boolean> {
    const site = await this.site(req);
    if (site === null) return false;
    const protection = site.map.protection;
    if (this.scanners.isBanned(req.socket.remoteAddress)) {
      this.refusals.record(req, GatewayEdgeCheck.SCANNER);
      this.reporter.refusedFrom(NetworkAddressUtils.subscriber(req.socket.remoteAddress));
      res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ error: 'blocked', reason: GatewayEdgeCheck.SCANNER }));
      return true;
    }
    const visitor = this.visitors.verdict(req, protection.rulesFor(site.tenantId));
    const probe = visitor.action === GatewayVisitorRules.REFUSE ? null : GatewayAttackFilter.reasonFor(req, protection);
    const attack = visitor.action === GatewayVisitorRules.REFUSE ? visitor.reason : probe;
    if (attack) {
      this.refusals.record(req, attack);
      // Only what a request asked for counts towards stopping its address, never who it came from.
      if (probe && GatewayEdgeCheck.askedForItself(req) && this.scanners.strike(req.socket.remoteAddress, protection.scannerBanAfter, protection.scannerBanMinutes, this.hostOf(req), String(req.url || '').split('?')[0])) {
        this.refusals.record(req, GatewayEdgeCheck.SCANNER);
        const stop = this.scanners.describe(req.socket.remoteAddress);
        if (stop) this.reporter.stopped(stop, GatewayEdgeCheck.SCANNER);
      }
      res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ error: 'blocked', reason: attack }));
      return true;
    }
    const wait = this.limit.retryAfter(req.socket.remoteAddress, protection.rateLimitPerMinute);
    if (wait > 0) {
      this.refusals.record(req, 'rate_limited');
      res.writeHead(429, { 'Content-Type': 'application/json; charset=utf-8', 'Retry-After': String(wait), 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ error: 'rate_limited', retryAfter: wait }));
      return true;
    }
    return this.challenge.handle(req, res, protection, site.tenantId, visitor.action === GatewayVisitorRules.CHECK);
  }

  /** Whether a WebSocket upgrade may pass. */
  async allowsUpgrade(req: http.IncomingMessage): Promise<boolean> {
    const site = await this.site(req);
    if (site === null) return true;
    if (this.scanners.isBanned(req.socket.remoteAddress)) return false;
    const visitor = this.visitors.verdict(req, site.map.protection.rulesFor(site.tenantId));
    return visitor.action !== GatewayVisitorRules.REFUSE && !GatewayAttackFilter.reasonFor(req, site.map.protection)
      && this.challenge.allowsUpgrade(req, site.map.protection, site.tenantId, visitor.action === GatewayVisitorRules.CHECK);
  }

  /**
   * Whether the visitor asked for this address itself, rather than a browser fetching it because
   * another site told it to. A page anywhere can embed `<img src="https://shop/.env">` and make every
   * one of its readers request it; counting those would let that page get innocent visitors stopped
   * on every site. Browsers name such requests in `Sec-Fetch-Site`; a scanner sends none.
   */
  private static askedForItself(req: http.IncomingMessage): boolean {
    const site = String(req.headers['sec-fetch-site'] || '').toLowerCase();
    return site === '' || site === 'none' || site === 'same-origin';
  }

  private async site(req: http.IncomingMessage) {
    const map = await this.routingMap();
    if (map && map !== this.synced) {
      this.synced = map;
      this.scanners.sync(map.stops, map.released);
    }
    const route = map?.resolve(this.hostOf(req));
    return map && route ? { map, tenantId: route.tenantId } : null;
  }
}

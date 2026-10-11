import http from 'http';
import type { TenantRouteMap } from '@fromcode119/core';
import { GatewayChallenge } from '@cli/services/gateway/challenge/gateway-challenge';
import { GatewayRateLimit } from '@cli/services/gateway/challenge/gateway-rate-limit';
import { GatewayAttackFilter } from '@cli/services/gateway/challenge/gateway-attack-filter';
import { GatewayVisitorRules } from '@cli/services/gateway/challenge/gateway-visitor-rules';

/**
 * Settings → Security → Edge protection, applied by the gateway before it routes: the request's
 * host names its site, and a site under attack mode checks the browser first (`GatewayChallenge`).
 * A host the routing map does not know is left to the gateway's own 404.
 */
export class GatewayEdgeCheck {
  constructor(
    /** The gateway's current routing map (it carries the protection settings). */
    private readonly routingMap: () => Promise<TenantRouteMap | null>,
    private readonly hostOf: (req: http.IncomingMessage) => string,
    private readonly challenge: GatewayChallenge = new GatewayChallenge(),
    private readonly limit: GatewayRateLimit = new GatewayRateLimit(),
    private readonly visitors: GatewayVisitorRules = new GatewayVisitorRules(),
  ) {}

  /** True when the check answered the request itself: an attack, too many requests, or the browser check. */
  async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<boolean> {
    const site = await this.site(req);
    if (site === null) return false;
    const visitor = this.visitors.verdict(req, site.map.protection.rulesFor(site.tenantId));
    const attack = visitor.action === 'refuse' ? visitor.reason : GatewayAttackFilter.reasonFor(req, site.map.protection);
    if (attack) {
      res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ error: 'blocked', reason: attack }));
      return true;
    }
    const wait = this.limit.retryAfter(req.socket.remoteAddress, site.map.protection.rateLimitPerMinute);
    if (wait > 0) {
      res.writeHead(429, { 'Content-Type': 'application/json; charset=utf-8', 'Retry-After': String(wait), 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ error: 'rate_limited', retryAfter: wait }));
      return true;
    }
    return this.challenge.handle(req, res, site.map.protection, site.tenantId, visitor.action === 'check');
  }

  /** Whether a WebSocket upgrade may pass. */
  async allowsUpgrade(req: http.IncomingMessage): Promise<boolean> {
    const site = await this.site(req);
    if (site === null) return true;
    const visitor = this.visitors.verdict(req, site.map.protection.rulesFor(site.tenantId));
    return visitor.action !== 'refuse' && !GatewayAttackFilter.reasonFor(req, site.map.protection)
      && this.challenge.allowsUpgrade(req, site.map.protection, site.tenantId, visitor.action === 'check');
  }

  private async site(req: http.IncomingMessage) {
    const map = await this.routingMap();
    const route = map?.resolve(this.hostOf(req));
    return map && route ? { map, tenantId: route.tenantId } : null;
  }
}

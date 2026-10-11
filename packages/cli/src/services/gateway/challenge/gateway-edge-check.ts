import http from 'http';
import type { TenantRouteMap } from '@fromcode119/core';
import { GatewayChallenge } from '@cli/services/gateway/challenge/gateway-challenge';

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
  ) {}

  /** True when the check answered the request itself. */
  async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<boolean> {
    const site = await this.site(req);
    return site !== null && this.challenge.handle(req, res, site.map.protection, site.tenantId);
  }

  /** Whether a WebSocket upgrade may pass. */
  async allowsUpgrade(req: http.IncomingMessage): Promise<boolean> {
    const site = await this.site(req);
    return site === null || this.challenge.allowsUpgrade(req, site.map.protection, site.tenantId);
  }

  private async site(req: http.IncomingMessage) {
    const map = await this.routingMap();
    const route = map?.resolve(this.hostOf(req));
    return map && route ? { map, tenantId: route.tenantId } : null;
  }
}

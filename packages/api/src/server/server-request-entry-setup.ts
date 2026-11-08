import type express from 'express';
import { EnvUtils, NetworkAddressUtils, RequestServerTiming } from '@fromcode119/core';
import { RequestMiddlewareTiming } from '@api/server/request-middleware-timing';

/** How a request is read before ANY middleware sees it: who sent it, and when it began. */
export class ServerRequestEntrySetup {
  static apply(app: express.Express): void {
    // Support nested proxies (e.g. Traefik -> Nginx -> Node). In containerized deployments the reverse
    // proxy connects from a PRIVATE subnet address (compose/Coolify networks live in 172.16/12 etc.),
    // not loopback — trusting only 127.0.0.1 made req.ip resolve to the proxy for every request, so ALL
    // visitors shared a single anonymous rate-limit bucket (100 req/15min for the whole storefront).
    // Trusting loopback + RFC1918 ranges restores per-visitor IPs from the edge proxy's X-Forwarded-For.
    app.set('trust proxy', (ip: string) => {
      if (EnvUtils.isDevelopment()) return true;
      return NetworkAddressUtils.isPrivate(ip);
    });
    // First of every middleware, so the time they spend is counted (`api-pre`) and every step a request
    // takes can say so in its `Server-Timing` — for an anonymous read only (RequestServerTiming).
    app.use(RequestServerTiming.middleware({ gated: true, totalAs: 'api-total' }));
    // …and each middleware mounted after it says what IT spent (`mw1`, `mw2`, …), so `api-pre` can be taken apart.
    RequestMiddlewareTiming.instrument(app);
  }
}

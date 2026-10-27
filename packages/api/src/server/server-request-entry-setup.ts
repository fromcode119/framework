import type express from 'express';
import { EnvUtils, NetworkAddressUtils } from '@fromcode119/core';
import { UnversionedApiAliasMiddleware } from '@api/middlewares/unversioned-api-alias-middleware';

/** How a request is read before ANY middleware sees it: who sent it, and which path it names. */
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
    // First, so every later middleware and router sees a legacy `/api/v<N>/...` as the `/api/...` path it names.
    app.use(new UnversionedApiAliasMiddleware().middleware());
  }
}

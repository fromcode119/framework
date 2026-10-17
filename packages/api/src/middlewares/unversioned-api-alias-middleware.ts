import type express from 'express';
import { ApiVersionUtils } from '@fromcode119/core';
import { ApiConfig } from '@api/config/api-config';

/**
 * Serves every api route at both the versioned and the bare path, whichever one the routes are mounted at.
 *
 * The routes live at ONE prefix — `ApiVersionUtils.prefix()`. This rewrites the other form to it before
 * ANY other middleware sees the request, so CORS, CSRF, the rate limiter, auth and the routers all
 * handle both exactly alike; there is one route table, never two.
 *
 *  - No version configured (the default): a legacy `/api/v1/...` (any `v<N>`) is rewritten to `/api/...`,
 *    which keeps every address handed out while the version was part of the path working — OAuth
 *    callbacks registered with a provider, webhook URLs, links in sent emails, installed app builds.
 *  - A version configured: a bare `/api/...` is rewritten to `/api/<version>/...`, except the probes
 *    `ServerRoutesSetup` registers straight under the base (`/api/health`, `/api/ready`).
 *
 * The base itself comes from the configuration too (`ApiVersionUtils.API_BASE_PATH`), not a literal.
 */
export class UnversionedApiAliasMiddleware {
  /** The path `url` is served at, or `url` itself when it already is (or is not an api path at all). */
  static rewrite(url: string): string {
    const base = ApiVersionUtils.API_BASE_PATH;
    const versioned = ApiVersionUtils.prefix();
    const legacy = new RegExp(`^${UnversionedApiAliasMiddleware.escape(base)}/v\\d+(?=[/?]|$)`, 'i');
    if (versioned === base) return legacy.test(url) ? url.replace(legacy, base) : url;
    if (!new RegExp(`^${UnversionedApiAliasMiddleware.escape(base)}(?=[/?]|$)`, 'i').test(url)) return url;
    if (legacy.test(url) || UnversionedApiAliasMiddleware.isProbe(url, base)) return url;
    return `${versioned}${url.slice(base.length)}`;
  }

  private static isProbe(url: string, base: string): boolean {
    const path = url.split('?')[0];
    return Object.values(ApiConfig.getInstance().probeRoutes).some((probe) => path === `${base}${probe}`);
  }

  private static escape(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  middleware() {
    return (req: express.Request, _res: express.Response, next: express.NextFunction): void => {
      const rewritten = UnversionedApiAliasMiddleware.rewrite(req.url);
      if (rewritten !== req.url) {
        req.url = rewritten;
        req.originalUrl = rewritten;
      }
      next();
    };
  }
}

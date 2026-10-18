import type express from 'express';
import { ApiVersionUtils, RequestSurfaceUtils } from '@fromcode119/core';
import { ApiConfig } from '@api/config/api-config';
import { LegacyApiPathUsage } from '@api/middlewares/legacy-api-path-usage';

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

  /**
   * A theme or plugin FILE (image, font, script) asked for at its legacy address is answered with a
   * permanent redirect rather than served in place. Crawlers and link previews (Facebook, Google) keep
   * the address they first saw and only replace it when told it moved; a silent alias leaves them asking
   * for the old one forever. API calls stay silent: a redirect can lose a request body, and an app or a
   * webhook sender may not follow one.
   */
  static isMovedAsset(method: string, path: string): boolean {
    return (method === 'GET' || method === 'HEAD') && RequestSurfaceUtils.isExtensionAssetPath(path);
  }

  private static escape(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  middleware() {
    return (req: express.Request, res: express.Response, next: express.NextFunction): void => {
      const rewritten = UnversionedApiAliasMiddleware.rewrite(req.url);
      if (rewritten !== req.url) {
        // Only the legacy direction is worth naming: it is an address someone outside still holds.
        const legacy = ApiVersionUtils.prefix() === ApiVersionUtils.API_BASE_PATH;
        if (legacy) LegacyApiPathUsage.record(req.method, req.url, req.headers['user-agent'], req.headers.referer);
        if (legacy && UnversionedApiAliasMiddleware.isMovedAsset(req.method, rewritten)) {
          res.redirect(301, rewritten);
          return;
        }
        req.url = rewritten;
        req.originalUrl = rewritten;
      }
      next();
    };
  }
}

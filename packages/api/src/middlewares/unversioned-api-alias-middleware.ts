import type express from 'express';
import { ApiVersionUtils, RequestSurfaceUtils } from '@fromcode119/core';
import { LegacyApiPathUsage } from '@api/middlewares/legacy-api-path-usage';

/**
 * Answers a legacy versioned api address (`/api/v1/...`, any `v<N>`) at the route it names (`/api/...`).
 *
 * The api has no version segment: every route lives directly under `ApiVersionUtils.prefix()`. Addresses
 * handed out while `/api/v1/...` was served still exist outside the platform — OAuth callbacks and
 * webhook URLs registered with a provider, links in sent emails, installed app builds, cached pages —
 * so the legacy form is rewritten before ANY other middleware sees the request. CORS, CSRF, the rate
 * limiter, auth and the routers then handle it exactly like the bare path; there is one route table.
 *
 * Every legacy request is counted (`LegacyApiPathUsage`), so the log names whoever still holds an old
 * address. The base itself comes from the configuration (`ApiVersionUtils.API_BASE_PATH`), not a literal.
 */
export class UnversionedApiAliasMiddleware {
  /** The path `url` is served at, or `url` itself when it already is (or is not an api path at all). */
  static rewrite(url: string): string {
    const base = ApiVersionUtils.API_BASE_PATH;
    const legacy = new RegExp(`^${UnversionedApiAliasMiddleware.escape(base)}/v\\d+(?=[/?]|$)`, 'i');
    return legacy.test(url) ? url.replace(legacy, base) : url;
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
        LegacyApiPathUsage.record(req.method, req.url, req.headers['user-agent'], req.headers.referer);
        if (UnversionedApiAliasMiddleware.isMovedAsset(req.method, rewritten)) {
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

import type express from 'express';
import { ApiVersionUtils } from '@fromcode119/core';
import { ApiConfig } from '@api/config/api-config';

/**
 * Serves every versioned api route at the bare `/api/...` path too.
 *
 * `/api/users` is rewritten to `/api/v1/users` before ANY other middleware sees it, so CORS, CSRF, the
 * rate limiter, auth and the routers all handle the alias exactly as they handle the versioned path —
 * there is one route table, never two. A path that already names a version (`/api/v1/...`, `/api/v2/...`)
 * passes through untouched, which keeps every address registered today (OAuth callbacks, webhooks,
 * links in sent emails) working while callers move to the shorter form.
 *
 * The probes `ServerRoutesSetup` registers straight under `/api` (`/api/health`, `/api/ready`) are left
 * alone: `/api/ready` has no versioned twin, and an orchestrator polling it must keep getting an answer.
 *
 * With no version configured the versioned prefix IS `/api`, and there is nothing to rewrite.
 */
export class UnversionedApiAliasMiddleware {
  private static readonly VERSION_SEGMENT = /^\/api\/v\d+([/?]|$)/i;
  private static readonly API_PATH = /^\/api([/?]|$)/i;

  /** The versioned form of `url`, or `url` itself when it is not an unversioned api path. */
  static rewrite(url: string): string {
    const base = ApiVersionUtils.API_BASE_PATH;
    const versioned = ApiVersionUtils.prefix();
    if (versioned === base) return url;
    if (!UnversionedApiAliasMiddleware.API_PATH.test(url)) return url;
    if (UnversionedApiAliasMiddleware.VERSION_SEGMENT.test(url)) return url;
    if (UnversionedApiAliasMiddleware.isProbe(url, base)) return url;
    return `${versioned}${url.slice(base.length)}`;
  }

  private static isProbe(url: string, base: string): boolean {
    const path = url.split('?')[0];
    return Object.values(ApiConfig.getInstance().probeRoutes).some((probe) => path === `${base}${probe}`);
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

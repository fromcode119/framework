import type express from 'express';
import { PlatformSettingsService, RequestContextUtils, SystemConstants } from '@fromcode119/core';
import { RobotsConstants } from '@fromcode119/core/constants/robots.constants';

/**
 * `X-Robots-Tag: noindex` on every api response served for a host with NO tenant.
 *
 * `PlatformRobotsRouter` answers `/robots.txt`, and that was the whole of it — which covers only the
 * crawler that asks first. A URL linked from anywhere else is fetched without consulting robots.txt,
 * and `Disallow` then makes things WORSE rather than better: the crawler may not read the page, so it
 * indexes the address alone, with no content to judge it by. The header is the half that says "you
 * have it, do not index it", and the console has emitted it since it was fixed. The api had nothing.
 *
 * Scoped to TENANT-LESS requests on purpose. A site's indexability is that site's own business
 * (`_system_tenants.visibility`, via `SiteVisibilityMiddleware`), and stamping a platform refusal on
 * a tenant's api response would let one switch silently de-index every customer — exactly the
 * coupling the operator is promised does not exist.
 *
 * FAIL-CLOSED and cached, for the same reasons as `AdminIndexingPolicy`: unset or unreadable both
 * read as "do not index", because a platform briefly refusing a crawler costs nothing while a
 * platform briefly inviting one into an index is not undone by any later correction.
 */
export class PlatformRobotsHeaderMiddleware {
  private static readonly TTL_MS = 60_000;
  private cachedAt = 0;
  private indexable = false;

  middleware() {
    return (_req: express.Request, res: express.Response, next: express.NextFunction): void => {
      // A bound tenant means this response belongs to a site, and the site owns the answer.
      if (RequestContextUtils.getTenantId()) {
        next();
        return;
      }
      if (this.refuses()) res.setHeader(RobotsConstants.HEADER, RobotsConstants.REFUSE);
      next();
    };
  }

  /**
   * Does this response refuse indexing?
   *
   * A STALE cache refuses rather than repeating its last answer, exactly as `AdminIndexingPolicy`
   * does, and for the same reason: repeating it is only safe in one direction. Turning indexing OFF
   * would otherwise leave a window — up to the whole TTL — in which responses still carried no
   * header, and that is precisely the direction that cannot be taken back. The cost of the other
   * direction is one over-strict header on the first request after a quiet minute.
   */
  private refuses(): boolean {
    if (Date.now() - this.cachedAt >= PlatformRobotsHeaderMiddleware.TTL_MS) {
      // Fire and forget, so the NEXT request is accurate.
      void this.refresh();
      return true;
    }
    return !this.indexable;
  }

  private async refresh(): Promise<void> {
    // `readFlag` is already fail-closed: it treats unset and unreadable alike as `false`. The catch is
    // for the call itself failing — leaving `cachedAt` untouched, so the next request refuses and
    // tries again rather than caching an answer that was never read.
    try {
      const indexable = await PlatformSettingsService.readFlag(SystemConstants.META_KEY.ADMIN_SEARCH_INDEXING);
      this.indexable = indexable;
      this.cachedAt = Date.now();
    } catch {
      this.indexable = false;
    }
  }
}

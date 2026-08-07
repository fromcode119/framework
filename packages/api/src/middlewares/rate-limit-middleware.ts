import { Request, Response, NextFunction } from 'express';
import rateLimit, { MemoryStore, RateLimitRequestHandler } from 'express-rate-limit';
import { BaseMiddleware } from '@api/middlewares/base-middleware';
import type { IRateLimitOptions } from '@api/middlewares/interfaces/rate-limit-options.interface';
import { PublicSystemRouteUtils } from '@api/utils/public-system-route-utils';
import { RateLimitBucketUtils } from '@api/utils/rate-limit-bucket-utils';
import { RateLimitSettingsUtils } from '@api/utils/rate-limit-settings-utils';

/**
 * The platform's ONE request limiter.
 *
 * Which bucket a request counts against, and how big that bucket is, both come from
 * {@link RateLimitBucketUtils} — see it for the ordering. Several buckets exist because one shared IP
 * was never one client: token-bearing requests are keyed per ip+token (a single admin page load fans
 * out dozens of plugin API calls, and the strict anonymous cap throttled the ENTIRE admin behind a
 * shared proxy IP), and internal service callers are keyed per calling service address (every
 * storefront render fetches this API from ONE frontend container with no visitor identity, so all
 * anonymous SSR used to share the single strict anonymous bucket and `/system/resolve` began
 * answering 429 under ordinary crawler load). Anonymous public traffic keeps the strict per-IP cap.
 *
 * Every budget, the window, and the list of addresses that counts as internal are the operator's
 * declared settings (admin Settings → Security). Nothing overrides them silently — the three call
 * sites that used to short-circuit with `if (NODE_ENV === 'development') return 10000` are gone.
 *
 * `express-rate-limit` bakes `windowMs` into the store at construction (it is a number, not a
 * resolver — the store starts a sweep timer with it), so a limiter built once at boot went on
 * counting in the OLD window after the operator changed "Rate Limit Window": the control saved, the
 * screen read the new value back, and nothing behaved differently until someone restarted the API.
 * The limiter is therefore rebuilt — once — when the resolved window actually changes.
 */
export class RateLimitMiddleware extends BaseMiddleware {
  private limiter: RateLimitRequestHandler;
  /** Held so a rebuild can stop the old store's sweep timer instead of leaking one per change. */
  private store: MemoryStore;
  private builtWindowMs: number;

  constructor(
    private readonly options: IRateLimitOptions = {},
    private readonly settingsCache?: Map<string, string>,
  ) {
    super();
    this.builtWindowMs = this.resolveWindowMs();
    this.store = new MemoryStore();
    this.limiter = this.buildLimiter();
  }

  async handle(req: Request, res: Response, next: NextFunction): Promise<void> {
    this.rebuildOnWindowChange();
    return this.limiter(req, res, next);
  }

  /** An explicit `windowMs` option wins; otherwise the operator's setting → env → seeded default. */
  private resolveWindowMs(): number {
    return this.options.windowMs || RateLimitSettingsUtils.resolveWindowMs(this.settingsCache);
  }

  /**
   * Swap in a limiter for the new window and release the old store's sweep timer. Counters restart,
   * which is the honest reading of "the operator changed how long a window lasts".
   */
  private rebuildOnWindowChange(): void {
    const windowMs = this.resolveWindowMs();
    if (windowMs === this.builtWindowMs) return;

    const previousStore = this.store;
    this.builtWindowMs = windowMs;
    this.store = new MemoryStore();
    this.limiter = this.buildLimiter();
    previousStore.shutdown();
  }

  private buildLimiter(): RateLimitRequestHandler {
    const message = this.options.message || 'Too many requests from this IP, please try again later';

    return rateLimit({
      windowMs: this.builtWindowMs,
      store: this.store,
      // An explicit `maxRequests` option still wins, but with none given a server render must not be
      // counted, and capped, as if it were one anonymous visitor.
      limit: (req) => this.options.maxRequests || RateLimitBucketUtils.resolveLimit(req as any, this.settingsCache),
      keyGenerator: (req) => RateLimitBucketUtils.resolveKey(req as any, this.settingsCache),
      message: { error: message },
      skip: (req) => {
        if (this.options.skip && this.options.skip(req)) return true;

        if (PublicSystemRouteUtils.isRateLimitBypassPath(String(req.path || ''))) return true;

        return !!req.headers['x-skip-rate-limit']
          && req.headers['x-skip-rate-limit'] === process.env.ADMIN_SECRET;
      },
    } as any);
  }
}

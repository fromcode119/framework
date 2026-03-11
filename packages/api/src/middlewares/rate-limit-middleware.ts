import { Request, Response, NextFunction } from 'express';
import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import { BaseMiddleware } from './base-middleware';
import type { RateLimitOptions } from './rate-limit-middleware.interfaces';

/**
 * Rate Limiting Middleware using express-rate-limit.
 * 
 * Responsibilities:
 * - Limit number of requests per IP address
 * - Configurable window and max requests
 * - Skip rate limiting for specific routes (health checks, SSE)
 * - Allow admin bypass via secret header
 * - Different limits for development vs production
 * 
 * @example
 * ```typescript
 * const rateLimiter = new RateLimitMiddleware({
 *   windowMs: 15 * 60 * 1000, // 15 minutes
 *   maxRequests: 100,
 *   skip: (req) => req.path.includes('/health')
 * });
 * app.use(rateLimiter.middleware());
 * ```
 */
export class RateLimitMiddleware extends BaseMiddleware {
  private limiter: RateLimitRequestHandler;

  constructor(options: RateLimitOptions = {}) {
    super();

    const windowMs = options.windowMs ||
      parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000');

    const maxRequests = options.maxRequests ||
      (process.env.NODE_ENV === 'development' ? 10000 : parseInt(process.env.RATE_LIMIT_MAX || '100'));

    const message = options.message ||
      'Too many requests from this IP, please try again later';

    this.limiter = rateLimit({
      windowMs,
      limit: maxRequests,
      message: { error: message },
      skip: (req) => {
        // Custom skip logic from options
        if (options.skip && options.skip(req)) {
          return true;
        }

        // Default skip logic
        // Skip rate limiting for EventSource (SSE) and health checks
        if (req.path.includes('/system/events') || req.path.includes('/health')) {
          return true;
        }

        // Admin bypass via secret header
        return !!req.headers['x-skip-rate-limit'] &&
          req.headers['x-skip-rate-limit'] === process.env.ADMIN_SECRET;
      }
    } as any);
  }

  async handle(req: Request, res: Response, next: NextFunction): Promise<void> {
    return this.limiter(req, res, next);
  }

  /**
   * Create a configurable rate limiter with dynamic settings.
   * Useful when rate limit settings are stored in database.
   * 
   * @example
   * ```typescript
   * const settingsCache = new Map<string, string>();
   * const limiter = createDynamicRateLimiter(settingsCache);
   * app.use(limiter);
   * ```
   */
  static createDynamic(settingsCache: Map<string, string>): RateLimitRequestHandler {
    return rateLimit({
      windowMs: () => {
        return parseInt(
          settingsCache.get('rate_limit_window') ||
          process.env.RATE_LIMIT_WINDOW_MS ||
          '900000'
        );
      },
      limit: (req) => {
        if (process.env.NODE_ENV === 'development') return 10000;
        return parseInt(
          settingsCache.get('rate_limit_max') ||
          process.env.RATE_LIMIT_MAX ||
          '100'
        );
      },
      message: { error: 'Too many requests from this IP, please try again later' },
      skip: (req) => {
        // Skip rate limiting for EventSource (SSE) and health checks
        if (req.path.includes('/system/events') || req.path.includes('/health')) {
          return true;
        }
        return !!req.headers['x-skip-rate-limit'] &&
          req.headers['x-skip-rate-limit'] === process.env.ADMIN_SECRET;
      }
    } as any);
  }

}


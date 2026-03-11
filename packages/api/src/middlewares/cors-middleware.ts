import { BaseMiddleware } from './base-middleware';
import { Request, Response, NextFunction } from 'express';

/**
 * CORS (Cross-Origin Resource Sharing) middleware.
 *
 * Sets the appropriate CORS response headers based on the configured list of
 * allowed origins. Handles pre-flight OPTIONS requests by responding with 204.
 *
 * @example
 * ```typescript
 * // Allow all origins (default)
 * app.use(new CorsMiddleware().middleware());
 *
 * // Restrict to specific origins
 * app.use(new CorsMiddleware(['https://app.example.com']).middleware());
 * ```
 */
export class CorsMiddleware extends BaseMiddleware {
  constructor(
    private allowedOrigins: string[] = ['*']
  ) {
    super();
  }

  handle(req: Request, res: Response, next: NextFunction): void {
    const origin = req.headers.origin;

    if (this.allowedOrigins.includes('*') || (origin && this.allowedOrigins.includes(origin))) {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
    } else {
      next();
    }
  }
}

import { BaseMiddleware } from './base-middleware';
import { Request, Response, NextFunction } from 'express';

/**
 * CORS (Cross-Origin Resource Sharing) middleware.
 *
 * Sets the appropriate CORS response headers based on the configured list of
 * allowed origins. Handles pre-flight OPTIONS requests by responding with 204.
 *
 * Combining `Access-Control-Allow-Origin: *` with `Access-Control-Allow-Credentials: true`
 * is forbidden by the spec and turns every cross-origin request into a credential leak.
 * This middleware therefore never reflects an arbitrary origin: callers must pass a concrete
 * allowlist; the wildcard `'*'` is honoured only without credentials.
 */
export class CorsMiddleware extends BaseMiddleware {
  constructor(
    private allowedOrigins: string[] = []
  ) {
    super();
  }

  handle(req: Request, res: Response, next: NextFunction): void {
    const origin = req.headers.origin;
    const wildcard = this.allowedOrigins.includes('*');
    const matched = origin && this.allowedOrigins.includes(origin);

    if (matched) {
      res.setHeader('Access-Control-Allow-Origin', origin as string);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    } else if (wildcard) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }

    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
    } else {
      next();
    }
  }
}

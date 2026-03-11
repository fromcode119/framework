import { BaseMiddleware } from './base-middleware';
import { Request, Response, NextFunction } from 'express';

/**
 * Request logging middleware.
 *
 * Logs each incoming request method and path, then logs the response
 * status code and duration when the response finishes.
 *
 * @example
 * ```typescript
 * app.use(new RequestLoggerMiddleware().middleware());
 * ```
 */
export class RequestLoggerMiddleware extends BaseMiddleware {
  handle(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();

    // Log request
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);

    // Log response when finished
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} (${duration}ms)`);
    });

    next();
  }
}

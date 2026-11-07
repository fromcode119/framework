import { Logger } from '@fromcode119/core';
import { Request, Response, NextFunction } from 'express';
import { BaseMiddleware } from '@api/middlewares/base-middleware';
import { ApiConfig } from '@api/config/api-config';

/**
 * The api's access log: ONE line per finished response — host, method, path, status, duration and the
 * signed-in user's id — written through the platform `Logger` (namespace `http`), so `LOG_LEVEL` governs it.
 *
 * Written on `finish`, not on arrival, so the line carries what the request GOT, including a refusal sent by
 * a later middleware. A server error is logged at `warn`, everything else at `info`.
 *
 * Deliberately left out: the query string (tokens, emails and search terms travel there), the user's email
 * (the id identifies them without putting personal data in the log), and liveness/readiness/status probes,
 * which a watchdog calls every few seconds and would bury every real request.
 */
export class RequestLoggerMiddleware extends BaseMiddleware {
  private static readonly logger = new Logger({ namespace: 'http' });

  handle(req: Request, res: Response, next: NextFunction): void {
    if (this.isProbe(req.originalUrl)) return next();
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const ms = Number((process.hrtime.bigint() - start) / 1_000_000n);
      const host = String(req.headers['x-forwarded-host'] || req.headers.host || '-');
      const path = req.originalUrl.split('?')[0];
      const user = (req as any).user?.id;
      const line = `${host} ${req.method} ${path} ${res.statusCode} ${ms}ms user=${user ?? '-'}`;
      if (res.statusCode >= 500) RequestLoggerMiddleware.logger.warn(line);
      else RequestLoggerMiddleware.logger.info(line);
    });
    next();
  }

  private isProbe(url: string): boolean {
    const config = ApiConfig.getInstance();
    return [config.probeRoutes.HEALTH, config.probeRoutes.READY, config.routes.system.HEALTH, config.routes.system.STATUS]
      .some((route) => url.includes(route));
  }
}

import { Request, Response, NextFunction } from 'express';
import { NetworkAddressUtils } from '@fromcode119/core';
import { BaseMiddleware } from '@api/middlewares/base-middleware';

/**
 * The visitor's address, resolved ONCE by the platform, for every plugin route: `req.clientIp`.
 *
 * A plugin must not read `x-forwarded-for` itself — the client writes that header, so a value taken
 * from it is whatever the visitor chose. `NetworkAddressUtils.resolveClientIp` is the platform's own
 * answer (`trust proxy` plus the edge provider's header). An isolated plugin receives the same value
 * from the host proxy (`PluginGuestHttp.HEADER_CLIENT_IP`), so plugin code reads one field in both.
 */
export class PluginClientAddressMiddleware extends BaseMiddleware {
  async handle(req: Request, _res: Response, next: NextFunction): Promise<void> {
    (req as any).clientIp = NetworkAddressUtils.resolveClientIp(req);
    next();
  }
}

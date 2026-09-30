import { Request, Response, NextFunction } from 'express';

import { EnvUtils } from '@fromcode119/core';

import { BaseMiddleware } from '@api/middlewares/base-middleware';

/**
 * The security headers every api response carries — mounted first in `ServerMiddlewareSetup`, so an
 * error or a refusal sent by a later middleware carries them too.
 *
 * No framing rule and no CSP here, deliberately. The api answers almost only JSON, and the pages people
 * interact with set their own: the console (`admin-content-security-policy`, `frame-ancestors 'self'`)
 * and the storefront (`X-Frame-Options: SAMEORIGIN`). The console also FRAMES api-served pages — a
 * plugin's preview, a background-download frame — and on a deployment where the console and the api are
 * different hosts (`admin.` / `api.`), any framing rule here would break exactly those.
 */
export class SecurityHeadersMiddleware extends BaseMiddleware {
  async handle(req: Request, res: Response, next: NextFunction): Promise<void> {
    // Prevent MIME type sniffing: a response is only ever what its Content-Type says.
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Full URLs never leak to other sites as referrers.
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Nothing the api serves needs these browser features.
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

    // HSTS — only over HTTPS in production, so an HTTP-only dev environment is never pinned. No
    // `includeSubDomains`: the api also answers on each SITE's own host, and pinning every subdomain of
    // a customer's domain is that customer's decision, not the platform's.
    const isHttps =
      req.secure ||
      req.get('x-forwarded-proto') === 'https' ||
      req.get('x-forwarded-port') === '443';
    if (EnvUtils.isProduction() && isHttps) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    }

    next();
  }
}

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { CookieConstants, Logger, RequestSurfaceUtils } from '@fromcode119/core';
import { RequestCookieService } from '@api/services/request/request-cookie-service';
import { ApiUrlUtils } from '@api/utils/url';
import { InternalRouteUtils } from '@api/utils/internal-route-utils';
import { McpRouteUtils } from '@api/utils/mcp-route-utils';
import { WebhookRouteUtils } from '@api/utils/webhook-route-utils';
import { BaseMiddleware } from '@api/middlewares/base-middleware';

export class CSRFMiddleware extends BaseMiddleware {
  private logger = new Logger({ namespace: 'security' });
  private readonly cookies = new RequestCookieService();

  /** Cookies that authenticate a request by themselves — what a cross-site post could ride on. */
  private static readonly SESSION_COOKIES = [
    CookieConstants.AUTH_TOKEN,
    CookieConstants.CLIENT_AUTH_TOKEN,
    CookieConstants.ADMIN_EXPORT_AUTH_TOKEN,
  ];

  private carriesSessionCookie(req: Request): boolean {
    return CSRFMiddleware.SESSION_COOKIES.some((name) => this.cookies.hasCookie(req, name));
  }

  async handle(req: Request, res: Response, next: NextFunction): Promise<void> {
    // 1. Generate CSRF token if not present in cookies OR if we need to ensure domain-scoping
    // We explicitly ensure it's on the root domain on health/status checks or if missing
    const hasCsrfCookie = this.cookies.hasCookie(req, CookieConstants.AUTH_CSRF);
    if (!hasCsrfCookie || (req.method === 'GET' && (req.path.includes('/status') || req.path.includes('/health')))) {
        // The root domain for cross-subdomain cookies — worked out only when a cookie may be set, which
        // is not on most requests. Host-scoped alongside the admin session it protects (see
        // AuthControllerCookieInfrastructure): a domain-wide token beside a host-scoped session is the
        // pair split across two scopes.
        const domain = RequestSurfaceUtils.isAdminRequestContext(req) ? undefined : ApiUrlUtils.getCookieDomain(req);
        const existingToken = this.cookies.readPrimaryCookieValue(req, CookieConstants.AUTH_CSRF);
        const token = existingToken || crypto.randomBytes(32).toString('hex');
        
        const isProd = process.env.NODE_ENV === 'production';
        const secure = isProd && ApiUrlUtils.isHttps(req);

        const cookieOptions: any = { 
            httpOnly: false,
            secure,
            sameSite: 'lax',
            path: '/'
        };

        if (domain) {
            cookieOptions.domain = domain;
        }

        // Only set if we either don't have it at all, OR we found a better domain to attach to
        if (!hasCsrfCookie || domain) {
            res.cookie(CookieConstants.AUTH_CSRF, token, cookieOptions);
        }
    }

    // 2. Skip for safe methods
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(req.method)) {
        return next();
    }

    // 3. Skip for non-cookie authentication (Authorization header or API key) — but ONLY when the
    // request carries no session cookie. The header alone proves nothing: a cross-site page can send an
    // arbitrary `Authorization: x` value, the authenticator rejects it and falls back to the session
    // cookie the browser attached, and the post would then ride that cookie with no CSRF check. With
    // no credential cookie present there is no ambient authority to ride on, so the header client is
    // safe to pass.
    if ((req.headers.authorization || req.headers['x-api-key']) && !this.carriesSessionCookie(req)) {
        return next();
    }

    // 4. Skip for webhooks (usually have their own signature verification)
    if (WebhookRouteUtils.isWebhookPath(req.path)) {
        return next();
    }

    // 4b. Skip for the MCP surface. Those routes accept API tokens ONLY (`requireApiToken` rejects
    // session cookies), so there is no cookie-borne authority for a cross-site post to ride on. Left
    // in, a machine client that forgot its key was told "Invalid CSRF token" instead of 401.
    if (McpRouteUtils.isMcpPath(req.path)) {
        return next();
    }

    // 4c. Skip for a service of this deployment calling an `/internal` route with the shared secret (the
    // updater's report). The secret is a header no browser attaches by itself, so there is no cookie-borne
    // authority for a cross-site post to ride on — the same reason as the MCP surface above.
    if (InternalRouteUtils.isAuthorizedInternal(req)) {
        return next();
    }

    // 5. Validate token
    const clientHeader = req.get('X-Framework-Client');
    const headerToken = String(req.headers['x-csrf-token'] || '');

    // Extract all cookies matching the configured CSRF cookie name from the raw header
    // to handle host-specific vs domain-specific cookie conflicts
    const csrfCandidates = this.cookies.collectCookieValues(req, CookieConstants.AUTH_CSRF);

    const isValid = csrfCandidates.some(candidate => candidate === headerToken);

    if (!headerToken || csrfCandidates.length === 0 || !isValid) {
        this.logger.warn(`CSRF Validation failed for ${req.method} ${req.path}. Header: ${headerToken ? 'present' : 'missing'}, Candidates: ${csrfCandidates.length}, Client: ${clientHeader || 'none'}`);
        res.status(403).json({ 
            error: 'Forbidden', 
            message: 'Invalid CSRF token' 
        });
        return;
    }

    next();
  }
}

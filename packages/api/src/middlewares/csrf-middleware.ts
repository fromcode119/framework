import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { CookieConstants, Logger, RequestSurfaceUtils } from '@fromcode119/core';
import { RequestCookieService } from '@api/services/request/request-cookie-service';
import { ApiUrlUtils } from '@api/utils/url';
import { McpRouteUtils } from '@api/utils/mcp-route-utils';
import { WebhookRouteUtils } from '@api/utils/webhook-route-utils';
import { BaseMiddleware } from '@api/middlewares/base-middleware';

export class CSRFMiddleware extends BaseMiddleware {
  private logger = new Logger({ namespace: 'security' });
  private readonly cookies = new RequestCookieService();

  async handle(req: Request, res: Response, next: NextFunction): Promise<void> {
    // Determine the root domain for cross-subdomain cookies
    // Host-scoped alongside the admin session it protects (see AuthControllerCookieInfrastructure).
    // A domain-wide CSRF token beside a host-scoped session is the pair split across two scopes.
    const domain = RequestSurfaceUtils.isAdminRequestContext(req)
      ? undefined
      : (process.env.COOKIE_DOMAIN || ApiUrlUtils.getCookieDomain(req));

    // 1. Generate CSRF token if not present in cookies OR if we need to ensure domain-scoping
    // We explicitly ensure it's on the root domain on health/status checks or if missing
    const hasCsrfCookie = this.cookies.hasCookie(req, CookieConstants.AUTH_CSRF);
    if (!hasCsrfCookie || (req.method === 'GET' && (req.path.includes('/status') || req.path.includes('/health')))) {
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

    // 3. Skip for non-cookie authentication (Authorization header or API Key)
    // These are safe from CSRF as browsers never auto-attach them.
    // An arbitrary custom header is NOT authentication. A browser on another allowlisted tenant
    // origin can pass CORS preflight, attach shared-domain cookies, and choose that header itself.
    // Cookie-authenticated clients must therefore present the CSRF token even when they identify as
    // admin-ui/frontend-ui or use X-Requested-With.
    const clientHeader = req.get('X-Framework-Client');

    if (req.headers.authorization || req.headers['x-api-key']) {
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

    // 5. Validate token
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

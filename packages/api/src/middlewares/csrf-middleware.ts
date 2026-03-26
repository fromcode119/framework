import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { CookieConstants, Logger } from '@fromcode119/core';
import { RequestCookieService } from '../services/request-cookie-service';
import { ApiUrlUtils } from '../utils/url';
import { BaseMiddleware } from './base-middleware';

export class CSRFMiddleware extends BaseMiddleware {
  private logger = new Logger({ namespace: 'security' });
  private readonly cookies = new RequestCookieService();

  async handle(req: Request, res: Response, next: NextFunction): Promise<void> {
    // Determine the root domain for cross-subdomain cookies
    const domain = process.env.COOKIE_DOMAIN || ApiUrlUtils.getCookieDomain(req);

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
    // Also skip for programmatic requests containing custom framework headers,
    // as browsers require CORS preflight for these, making them safe from automatic form-based CSRF.
    const clientHeader = req.get('X-Framework-Client');
    const xRequestedWith = req.get('X-Requested-With');
    
    if (req.headers.authorization || req.headers['x-api-key'] || clientHeader || xRequestedWith) {
        return next();
    }

    // 4. Skip for webhooks (usually have their own signature verification)
    if (req.path.includes('/webhooks/')) {
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

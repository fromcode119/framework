import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { Logger } from '@fromcode119/core';
import { ApiUrlUtils } from '../utils/url';
import { BaseMiddleware } from './base-middleware';

export class CSRFMiddleware extends BaseMiddleware {
  private logger = new Logger({ namespace: 'security' });

  async handle(req: Request, res: Response, next: NextFunction): Promise<void> {
    // Determine the root domain for cross-subdomain cookies
    const domain = process.env.COOKIE_DOMAIN || ApiUrlUtils.getCookieDomain(req);

    // 1. Generate CSRF token if not present in cookies OR if we need to ensure domain-scoping
    // We explicitly ensure it's on the root domain on health/status checks or if missing
    if (!req.cookies.fc_csrf || (req.method === 'GET' && (req.path.includes('/status') || req.path.includes('/health')))) {
        const existingToken = req.cookies.fc_csrf;
        const token = (typeof existingToken === 'string' ? existingToken : null) || crypto.randomBytes(32).toString('hex');
        
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
        if (!req.cookies.fc_csrf || domain) {
            res.cookie('fc_csrf', token, cookieOptions);
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

    // Extract ALL cookies with the name 'fc_csrf' from the raw Cookie header
    // to handle host-specific vs domain-specific cookie conflicts
    const csrfCandidates: string[] = [];
    if (req.headers.cookie) {
        const rawCookies = String(req.headers.cookie).split(';');
        rawCookies.forEach(c => {
            const parts = c.trim().split('=');
            if (parts.length >= 2) {
                const name = parts[0].trim();
                const value = parts.slice(1).join('=').trim();
                if (name === 'fc_csrf' && value) {
                    csrfCandidates.push(value);
                }
            }
        });
    }

    // Fallback to req.cookies if populated
    if (req.cookies?.fc_csrf) {
        if (Array.isArray(req.cookies.fc_csrf)) {
            req.cookies.fc_csrf.forEach((t: string) => {
                if (t && !csrfCandidates.includes(t)) csrfCandidates.push(t);
            });
        } else if (typeof req.cookies.fc_csrf === 'string' && !csrfCandidates.includes(req.cookies.fc_csrf)) {
            csrfCandidates.push(req.cookies.fc_csrf);
        }
    }

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
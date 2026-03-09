import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { Logger } from '@fromcode119/core';
import { getCookieDomain, isHttps } from '../utils/url';
import { BaseMiddleware } from './BaseMiddleware';

/**
 * CSRF Protection Middleware using Double Cookie Submit pattern.
 * 
 * Responsibilities:
 * - Generate CSRF token cookie for GET requests
 * - Validate CSRF token on state-changing requests (POST, PUT, DELETE, PATCH)
 * - Skip validation for safe methods (GET, HEAD, OPTIONS)
 * - Skip validation for non-cookie auth (Authorization header, API keys)
 * - Handle domain-specific vs host-specific cookie conflicts
 * 
 * @example
 * ```typescript
 * const csrfMiddleware = new CSRFMiddleware();
 * app.use(csrfMiddleware.middleware());
 * ```
 */
export class CSRFMiddleware extends BaseMiddleware {
  private logger = new Logger({ namespace: 'security' });

  async handle(req: Request, res: Response, next: NextFunction): Promise<void> {
    // Determine the root domain for cross-subdomain cookies
    const domain = process.env.COOKIE_DOMAIN || getCookieDomain(req);

    // 1. Generate CSRF token if not present in cookies OR if we need to ensure domain-scoping
    // We explicitly ensure it's on the root domain on health/status checks or if missing
    if (!req.cookies.fc_csrf || (req.method === 'GET' && (req.path.includes('/status') || req.path.includes('/health')))) {
        const existingToken = req.cookies.fc_csrf;
        const token = (typeof existingToken === 'string' ? existingToken : null) || crypto.randomBytes(32).toString('hex');
        
        const isProd = process.env.NODE_ENV === 'production';
        const secure = isProd && isHttps(req);

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

/**
 * XSS Sanitization Middleware for JSON request bodies.
 * 
 * Responsibilities:
 * - Remove <script> tags from string values
 * - Remove inline event handlers (onclick, onload, etc.)
 * - Recursively sanitize nested objects and arrays
 * 
 * Note: This is basic sanitization. For HTML content, use proper HTML sanitizers.
 * 
 * @example
 * ```typescript
 * const xssMiddleware = new XSSMiddleware();
 * app.use(express.json());
 * app.use(xssMiddleware.middleware());
 * ```
 */
export class XSSMiddleware extends BaseMiddleware {
  async handle(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (req.body && typeof req.body === 'object') {
        this.sanitize(req.body);
    }
    next();
  }

  /**
   * Recursively sanitize object properties.
   */
  private sanitize(obj: any): void {
    for (const key in obj) {
        if (typeof obj[key] === 'string') {
            // Very basic: escape script tags and inline event handlers
            obj[key] = obj[key]
                .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, '')
                .replace(/[^\w\s]on\w+="[^"]*"/gim, '');
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            this.sanitize(obj[key]);
        }
    }
  }
}

/**
 * Security Headers Middleware.
 * 
 * Adds essential security headers to all responses:
 * - X-Content-Type-Options: nosniff
 * - X-Frame-Options: DENY (prevent clickjacking)
 * - X-XSS-Protection: 1; mode=block
 * - Referrer-Policy: strict-origin-when-cross-origin
 * - Permissions-Policy: control browser features
 * 
 * @example
 * ```typescript
 * const securityHeaders = new SecurityHeadersMiddleware();
 * app.use(securityHeaders.middleware());
 * ```
 */
export class SecurityHeadersMiddleware extends BaseMiddleware {
  async handle(req: Request, res: Response, next: NextFunction): Promise<void> {
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    
    // XSS Protection (legacy but still useful for older browsers)
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Permissions policy (restrict browser features)
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=()'
    );

    next();
  }
}

// ===== Legacy Factory Functions (Backwards Compatibility) =====

/**
 * Legacy CSRF middleware factory.
 * @deprecated Use CSRFMiddleware class instead - Will be removed in v2.0
 */
export function csrfMiddleware(req: Request, res: Response, next: NextFunction) {
  return new CSRFMiddleware().handle(req, res, next);
}

/**
 * Legacy XSS middleware factory.
 * @deprecated Use XSSMiddleware class instead - Will be removed in v2.0
 */
export function xssMiddleware(req: Request, res: Response, next: NextFunction) {
  return new XSSMiddleware().handle(req, res, next);
}

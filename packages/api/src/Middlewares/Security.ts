import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { Logger } from '@fromcode/core';

const logger = new Logger({ namespace: 'security' });

/**
 * Lightweight CSRF Protection using the Double Cookie Submit pattern
 */
export function csrfMiddleware(req: Request, res: Response, next: NextFunction) {
    // Determine the root domain for cross-subdomain cookies
    let domain = process.env.COOKIE_DOMAIN;
    
    // Fallback: Try to extract domain from Host or X-Forwarded-Host if available
    const host = req.get('x-forwarded-host') || req.get('host') || req.hostname;
    const hostname = host.split(':')[0];

    if (!domain && hostname.includes('.') && !hostname.match(/^\d+\.\d+\.\d+\.\d+$/) && hostname !== 'localhost') {
        const parts = hostname.split('.');
        if (parts.length >= 2) {
            domain = '.' + parts.slice(-2).join('.');
        }
    }

    // 1. Generate CSRF token if not present in cookies OR if we need to ensure domain-scoping
    // We explicitly ensure it's on the root domain on health/status checks or if missing
    if (!req.cookies.fc_csrf || (req.method === 'GET' && (req.path.includes('/status') || req.path.includes('/health')))) {
        const existingToken = req.cookies.fc_csrf;
        const token = (typeof existingToken === 'string' ? existingToken : null) || crypto.randomBytes(32).toString('hex');
        
        const isProd = process.env.NODE_ENV === 'production';
        const isHttps = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https';

        const cookieOptions: any = { 
            httpOnly: false,
            secure: isProd && isHttps,
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
        logger.warn(`CSRF Validation failed for ${req.method} ${req.path}. Header: ${headerToken ? 'present' : 'missing'}, Candidates: ${csrfCandidates.length}, Client: ${clientHeader || 'none'}`);
        return res.status(403).json({ 
            error: 'Forbidden', 
            message: 'Invalid CSRF token' 
        });
    }

    next();
}

/**
 * Basic XSS Sanitization for JSON bodies
 */
export function xssMiddleware(req: Request, res: Response, next: NextFunction) {
    if (req.body && typeof req.body === 'object') {
        const sanitize = (obj: any) => {
            for (const key in obj) {
                if (typeof obj[key] === 'string') {
                    // Very basic: escape script tags
                    obj[key] = obj[key]
                        .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, '')
                        .replace(/[^\w\s]on\w+="[^"]*"/gim, '');
                } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                    sanitize(obj[key]);
                }
            }
        };
        sanitize(req.body);
    }
    next();
}

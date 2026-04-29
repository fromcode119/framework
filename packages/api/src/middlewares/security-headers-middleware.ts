import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { Logger } from '@fromcode119/core';
import { ApiUrlUtils } from '../utils/url';
import { BaseMiddleware } from './base-middleware';

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

    // HSTS — only emit over HTTPS to avoid pinning HTTP-only dev environments.
    const isHttps =
      req.secure ||
      req.get('x-forwarded-proto') === 'https' ||
      req.get('x-forwarded-port') === '443';
    if (process.env.NODE_ENV === 'production' && isHttps) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    // Baseline CSP. Tightening (removing 'unsafe-inline'/'unsafe-eval') requires
    // a separate migration to nonces; this baseline still blocks framing, plugin
    // objects, mixed content, and form-action exfiltration.
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "form-action 'self'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https:",
      "style-src 'self' 'unsafe-inline' https:",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
      "connect-src 'self' https: wss:",
      'upgrade-insecure-requests',
    ].join('; ');
    res.setHeader('Content-Security-Policy', csp);

    next();
  }
}
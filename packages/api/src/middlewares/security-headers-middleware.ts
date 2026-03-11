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

    next();
  }
}
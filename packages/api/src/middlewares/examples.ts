/**
 * Example middleware implementations using BaseMiddleware.
 * 
 * These examples demonstrate how to migrate from factory functions to classes.
 */

import { BaseMiddleware } from '../middlewares/BaseMiddleware';
import { Request, Response, NextFunction } from 'express';

/**
 * Example: Request logging middleware.
 */
export class RequestLoggerMiddleware extends BaseMiddleware {
  handle(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();
    
    // Log request
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    
    // Log response when finished
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} (${duration}ms)`);
    });
    
    next();
  }
}

/**
 * Example: CORS middleware.
 */
export class CorsMiddleware extends BaseMiddleware {
  constructor(
    private allowedOrigins: string[] = ['*']
  ) {
    super();
  }

  handle(req: Request, res: Response, next: NextFunction): void {
    const origin = req.headers.origin;
    
    if (this.allowedOrigins.includes('*') || (origin && this.allowedOrigins.includes(origin))) {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
    } else {
      next();
    }
  }
}

/**
 * Example: Rate limiting middleware.
 */
export class RateLimitMiddleware extends BaseMiddleware {
  private requests = new Map<string, number[]>();

  constructor(
    private maxRequests: number = 100,
    private windowMs: number = 60000
  ) {
    super();
  }

  handle(req: Request, res: Response, next: NextFunction): void {
    const key = req.ip || 'unknown';
    const now = Date.now();
    
    // Get request timestamps for this IP
    const timestamps = this.requests.get(key) || [];
    
    // Remove old timestamps outside the window
    const validTimestamps = timestamps.filter((ts) => now - ts < this.windowMs);
    
    // Check if limit exceeded
    if (validTimestamps.length >= this.maxRequests) {
      res.status(429).json({
        error: 'Too many requests',
        retryAfter: this.windowMs - (now - validTimestamps[0]),
      });
      return;
    }
    
    // Add current timestamp
    validTimestamps.push(now);
    this.requests.set(key, validTimestamps);
    
    next();
  }
}

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { Logger } from '@fromcode119/core';
import { ApiUrlUtils } from '../utils/url';
import { BaseMiddleware } from './base-middleware';

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
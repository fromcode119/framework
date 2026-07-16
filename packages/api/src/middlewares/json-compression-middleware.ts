import { Request, Response, NextFunction } from 'express';
import zlib from 'zlib';
import { CookieConstants } from '@fromcode119/core';
import { BaseMiddleware } from './base-middleware';

/**
 * Gzip compression for ANONYMOUS public JSON GET responses.
 *
 * The api registered no compression middleware at all, so payloads like
 * `/api/v1/system/frontend` shipped ~24KB of uncompressed JSON on every storefront
 * boot (storefront-performance-audit.md §1.5, Phase 1.5). Static JS/CSS assets are
 * already served from precomputed `.gz` files by the archive-support classes; this
 * middleware closes the JSON gap.
 *
 * BREACH scoping (audit §4 "Compression"): compressing responses that mix
 * session-derived secrets with attacker-reflected request input is unsafe, so this
 * middleware only compresses when the request is ANONYMOUS — no Authorization
 * header and no auth cookie. Authenticated responses are left uncompressed exactly
 * as before. GET-only, JSON-only (`res.json`), and only above a minimum size where
 * gzip actually pays for itself.
 */
export class JsonCompressionMiddleware extends BaseMiddleware {
  private static readonly MIN_COMPRESS_BYTES = 1024;

  handle(req: Request, res: Response, next: NextFunction): void {
    if (!JsonCompressionMiddleware.isCompressibleRequest(req)) {
      next();
      return;
    }

    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      const payload = JSON.stringify(body);
      if (
        typeof payload !== 'string' ||
        Buffer.byteLength(payload) < JsonCompressionMiddleware.MIN_COMPRESS_BYTES ||
        res.headersSent ||
        res.getHeader('Content-Encoding')
      ) {
        return originalJson(body);
      }

      const compressed = zlib.gzipSync(Buffer.from(payload, 'utf8'));
      res.setHeader('Content-Encoding', 'gzip');
      res.vary('Accept-Encoding');
      if (!res.getHeader('Content-Type')) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
      }
      res.removeHeader('Content-Length');
      return res.send(compressed);
    }) as Response['json'];

    next();
  }

  private static isCompressibleRequest(req: Request): boolean {
    if (req.method !== 'GET') return false;
    if (!String(req.headers['accept-encoding'] || '').toLowerCase().includes('gzip')) return false;
    if (req.headers.authorization) return false;
    const cookieHeader = String(req.headers.cookie || '');
    return !CookieConstants.AUTH_COOKIES_TO_CLEAR.some((name) => cookieHeader.includes(`${name}=`));
  }
}

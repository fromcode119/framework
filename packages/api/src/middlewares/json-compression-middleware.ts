import { Request, Response, NextFunction } from 'express';
import zlib from 'zlib';
import { ResponseCompressionPolicy } from '@fromcode119/core';
import { BaseMiddleware } from '@api/middlewares/base-middleware';

/**
 * Gzip compression for JSON GET responses the api answers itself.
 *
 * The api registered no compression middleware at all, so payloads like `/api/v1/system/frontend`
 * shipped uncompressed JSON on every storefront boot. Static JS/CSS are already served from precomputed
 * `.gz` files by the archive-support classes; this middleware closes the JSON gap. A plugin's answer
 * streams back through `PluginHostHttpProxy` instead and is compressed there, by the same policy.
 *
 * ## Why it did nothing in a browser until 2026-08-01
 *
 * The gate skipped compression whenever ANY cookie in `AUTH_COOKIES_TO_CLEAR` was present — and that
 * list includes the CSRF cookie, which the storefront sets for **every anonymous visitor**. So the
 * middleware compressed under `curl` and never once in a real browser. When it may compress is now
 * `ResponseCompressionPolicy`'s decision, including the BREACH scoping.
 *
 * GET-only, JSON-only (`res.json`), and only above a minimum size where gzip pays for itself.
 */
export class JsonCompressionMiddleware extends BaseMiddleware {
  handle(req: Request, res: Response, next: NextFunction): void {
    if (!ResponseCompressionPolicy.mayCompress(req)) {
      next();
      return;
    }

    const secrets = ResponseCompressionPolicy.secrets(req);
    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      // `JSON.stringify` is typed as always returning `string`, but it returns `undefined` at
      // runtime for `undefined`/a function/a symbol — this check is real, not decorative.
      const payload = JSON.stringify(body) as string | undefined;
      if (
        typeof payload !== 'string' ||
        res.headersSent ||
        res.getHeader('Content-Encoding') ||
        !ResponseCompressionPolicy.compressesBody(payload, secrets)
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
}

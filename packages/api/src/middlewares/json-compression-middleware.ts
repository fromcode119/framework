import { Request, Response, NextFunction } from 'express';
import zlib from 'zlib';
import { CookieConstants } from '@fromcode119/core';
import { BaseMiddleware } from '@api/middlewares/base-middleware';

/**
 * Gzip compression for public JSON GET responses.
 *
 * The api registered no compression middleware at all, so payloads like `/api/v1/system/frontend`
 * shipped uncompressed JSON on every storefront boot. Static JS/CSS are already served from precomputed
 * `.gz` files by the archive-support classes; this middleware closes the JSON gap.
 *
 * ## Why it did nothing in a browser until 2026-08-01
 *
 * The gate skipped compression whenever ANY cookie in `AUTH_COOKIES_TO_CLEAR` was present — and that
 * list includes the CSRF cookie, which the storefront sets for **every anonymous visitor**. So the
 * middleware compressed under `curl` and never once in a real browser: the homepage's product feed
 * shipped 202 KB instead of 23 KB, and the i18n dictionary 75 KB instead of ~8 KB, on every page load.
 * The membership test was also a substring match on the raw header, so a CLEARED cookie (`name=`)
 * counted as present.
 *
 * ## BREACH scoping, done precisely
 *
 * Compressing a response is unsafe when it mixes a SECRET with attacker-reflected request input. Two
 * guards, and neither is "some cookie exists":
 *  - An AUTHENTICATED request (a real session credential with a non-empty value) is never compressed,
 *    as before. The CSRF cookie is not a session credential and no longer disables the feature.
 *  - A response whose body CONTAINS one of the request's cookie values is never compressed — that is
 *    the actual BREACH precondition, checked directly instead of inferred from cookie presence.
 *
 * GET-only, JSON-only (`res.json`), and only above a minimum size where gzip pays for itself.
 */
export class JsonCompressionMiddleware extends BaseMiddleware {
  private static readonly MIN_COMPRESS_BYTES = 1024;

  /** A cookie value is only worth guarding as a secret when it is long enough to be worth attacking. */
  private static readonly MIN_SECRET_LENGTH = 8;

  /** Real session credentials. NOT the CSRF cookie — every anonymous visitor carries that one. */
  private static readonly SESSION_COOKIES: readonly string[] = [
    CookieConstants.AUTH_TOKEN,
    CookieConstants.AUTH_USER,
    CookieConstants.CLIENT_AUTH_TOKEN,
    CookieConstants.ADMIN_EXPORT_AUTH_TOKEN,
  ];

  handle(req: Request, res: Response, next: NextFunction): void {
    if (!JsonCompressionMiddleware.isCompressibleRequest(req)) {
      next();
      return;
    }

    const secrets = JsonCompressionMiddleware.cookieSecrets(req);
    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      const payload = JSON.stringify(body);
      if (
        typeof payload !== 'string' ||
        Buffer.byteLength(payload) < JsonCompressionMiddleware.MIN_COMPRESS_BYTES ||
        res.headersSent ||
        res.getHeader('Content-Encoding') ||
        secrets.some((secret) => payload.includes(secret))
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

    const cookies = JsonCompressionMiddleware.parseCookies(req);
    return !JsonCompressionMiddleware.SESSION_COOKIES.some((name) => Boolean(cookies.get(name)));
  }

  /** Every non-trivial cookie VALUE the request carries — what a BREACH oracle would be hunting for. */
  private static cookieSecrets(req: Request): string[] {
    return [...JsonCompressionMiddleware.parseCookies(req).values()]
      .filter((value) => value.length >= JsonCompressionMiddleware.MIN_SECRET_LENGTH);
  }

  /**
   * Name → value, with cleared cookies (`name=`) treated as absent. A substring test on the raw header
   * cannot tell `fc_token=abc` from `fc_token=`, nor from a cookie whose NAME merely contains another's.
   */
  private static parseCookies(req: Request): Map<string, string> {
    const parsed = new Map<string, string>();
    for (const pair of String(req.headers.cookie || '').split(';')) {
      const separator = pair.indexOf('=');
      if (separator < 0) continue;
      const name = pair.slice(0, separator).trim();
      const rawValue = pair.slice(separator + 1).trim();
      if (!name || !rawValue) continue;
      let value = rawValue;
      try {
        value = decodeURIComponent(rawValue);
      } catch {
        /* a malformed escape is not a reason to drop the cookie — keep the raw value */
      }
      parsed.set(name, value);
    }
    return parsed;
  }
}

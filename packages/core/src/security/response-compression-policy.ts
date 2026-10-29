import type { IncomingMessage } from 'http';
import { CookieConstants } from '@core/constants/cookie.constants';

/**
 * When a JSON answer may be gzipped, decided once for every path that sends one: the api's own routes
 * (`JsonCompressionMiddleware`) and a plugin's routes, whose answers stream back through the host's
 * proxy and never pass `res.json` on the api side.
 *
 * ## BREACH scoping
 *
 * Compressing a response is unsafe when it mixes a SECRET with attacker-reflected request input, and the
 * attacker can make the victim's browser repeat the request with that secret attached. Two guards:
 *  - A request carrying a SESSION COOKIE is never compressed: a browser attaches cookies to cross-site
 *    requests by itself. The CSRF cookie is not a session credential and does not disable compression.
 *  - A response whose body CONTAINS one of the request's secrets (a cookie value, or the bearer token)
 *    is never compressed — the actual BREACH precondition, checked directly.
 *
 * A bearer token alone does not stop compression: no browser attaches an `Authorization` header to a
 * request another site makes, so an attacker cannot replay it. Excluding it left every signed-in app
 * user downloading uncompressed answers.
 */
export class ResponseCompressionPolicy {
  static readonly MIN_COMPRESS_BYTES = 1024;

  /** A secret is only worth guarding when it is long enough to be worth attacking. */
  private static readonly MIN_SECRET_LENGTH = 8;

  /** Real session credentials. NOT the CSRF cookie — every anonymous visitor carries that one. */
  private static readonly SESSION_COOKIES: readonly string[] = [
    CookieConstants.AUTH_TOKEN,
    CookieConstants.AUTH_USER,
    CookieConstants.CLIENT_AUTH_TOKEN,
    CookieConstants.ADMIN_EXPORT_AUTH_TOKEN,
  ];

  /** A GET from a client that accepts gzip and carries no session cookie. */
  static mayCompress(req: IncomingMessage): boolean {
    if (req.method !== 'GET') return false;
    if (!String(req.headers['accept-encoding'] || '').toLowerCase().includes('gzip')) return false;
    const cookies = ResponseCompressionPolicy.parseCookies(req);
    return !ResponseCompressionPolicy.SESSION_COOKIES.some((name) => Boolean(cookies.get(name)));
  }

  /** Every non-trivial secret the request carries — what a BREACH oracle would be hunting for. */
  static secrets(req: IncomingMessage): string[] {
    const values = [...ResponseCompressionPolicy.parseCookies(req).values()];
    const bearer = /^Bearer\s+(.+)$/i.exec(String(req.headers.authorization || '').trim());
    if (bearer) values.push(bearer[1].trim());
    return values.filter((value) => value.length >= ResponseCompressionPolicy.MIN_SECRET_LENGTH);
  }

  /** Big enough to pay for gzip, and holding none of the request's secrets. */
  static compressesBody(payload: string, secrets: readonly string[]): boolean {
    return Buffer.byteLength(payload) >= ResponseCompressionPolicy.MIN_COMPRESS_BYTES
      && !secrets.some((secret) => payload.includes(secret));
  }

  /**
   * Name → value, with cleared cookies (`name=`) treated as absent. A substring test on the raw header
   * cannot tell `fc_token=abc` from `fc_token=`, nor from a cookie whose NAME merely contains another's.
   */
  private static parseCookies(req: IncomingMessage): Map<string, string> {
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

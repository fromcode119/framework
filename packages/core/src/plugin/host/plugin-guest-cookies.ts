import type { NextFunction, Request, Response } from 'express';

/**
 * A plugin's request carries the caller's cookies as `req.cookies`, as the api's own routes do.
 *
 * The api parses them (cookie-parser), but a plugin's route runs in its own process behind the api, on an
 * app that parsed none: `req.cookies` was undefined in every plugin. A plugin that bound something to the
 * browser by a cookie — a visitor's consent record, a session read from its cookie — could never find it,
 * so every read-back answered as if the cookie were missing.
 *
 * Parsed the way cookie-parser does: the first value of a repeated name wins, values are URI-decoded (a
 * malformed escape keeps the raw value), and a pair without a name is skipped.
 */
export class PluginGuestCookies {
  static parse(header: unknown): Record<string, string> {
    const cookies: Record<string, string> = {};
    for (const pair of String(header ?? '').split(';')) {
      const separator = pair.indexOf('=');
      if (separator < 0) continue;
      const name = pair.slice(0, separator).trim();
      if (!name || Object.prototype.hasOwnProperty.call(cookies, name)) continue;
      let value = pair.slice(separator + 1).trim();
      if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) value = value.slice(1, -1);
      try {
        value = decodeURIComponent(value);
      } catch {
        /* keep the raw value */
      }
      cookies[name] = value;
    }
    return cookies;
  }

  static restore(req: Request, _res: Response, next: NextFunction): void {
    if (!(req as any).cookies) (req as any).cookies = PluginGuestCookies.parse(req.headers.cookie);
    next();
  }
}

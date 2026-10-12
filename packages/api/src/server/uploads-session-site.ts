import type { Request } from 'express';
import { CoercionUtils, CookieConstants } from '@fromcode119/core';

/**
 * The site an admin's session is working in, for an uploads request on a host that names no site.
 *
 * The shared console serves every site from ONE host, so the host cannot say whose file an image is:
 * a site's media listed in the console pointed at `/uploads/<file>` on the console host, which looked
 * only in the shared parent and answered 404 for everything uploaded since sites had their own
 * directory. The session already says which site the console is in — it is the token's `tenantId`,
 * the same one every api request from that page acts in — so the file comes from that site's
 * directory.
 *
 * The token is VERIFIED (signature and live session), never just decoded. The answer is remembered
 * briefly per token, because one media grid is dozens of image requests and each would otherwise be
 * a session lookup.
 */
export class UploadsSessionSite {
  private static readonly TTL_MS = 60_000;
  private static readonly MAX_ENTRIES = 500;
  private readonly cache = new Map<string, { site: string | null; until: number }>();

  constructor(private readonly verify: (token: string) => Promise<unknown>) {}

  async siteFor(req: Request): Promise<string | null> {
    const token = UploadsSessionSite.adminToken(req);
    if (!token) return null;
    const cached = this.cache.get(token);
    if (cached && cached.until > Date.now()) return cached.site;

    const site = await this.verify(token)
      .then((user) => CoercionUtils.toString((user as { tenantId?: unknown } | null)?.tenantId).trim() || null)
      .catch(() => null);
    if (this.cache.size >= UploadsSessionSite.MAX_ENTRIES) this.cache.clear();
    this.cache.set(token, { site, until: Date.now() + UploadsSessionSite.TTL_MS });
    return site;
  }

  /** The admin session cookie's value, read from the raw header: this mount runs before cookie parsing. */
  private static adminToken(req: Request): string | null {
    const header = CoercionUtils.toString(req.headers?.cookie);
    for (const part of header.split(';')) {
      const at = part.indexOf('=');
      if (at === -1) continue;
      if (part.slice(0, at).trim() !== CookieConstants.AUTH_TOKEN) continue;
      const value = decodeURIComponent(part.slice(at + 1).trim());
      return value || null;
    }
    return null;
  }
}

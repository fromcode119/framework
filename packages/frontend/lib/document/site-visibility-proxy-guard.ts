import { CookieConstants } from '@fromcode119/core/client';
/**
 * Answers for a site that has not been published, before any page runs.
 *
 * It has to be here. The storefront has several document entry points — the islands route, the home
 * page and the catch-all page, each with its own `generateMetadata` — and they all resolve content
 * through the api, which refuses a private site with a 503. The storefront reads an api 503 as
 * "unavailable", so the visitor got a 500 from whichever entry ran first. Guarding one of them left
 * the others; the proxy is the single thing every document request passes through, and the only
 * place that can answer with a real status instead of rendering a page.
 *
 * A Next page cannot return 503 at all — the most it can do is `notFound()`, and 404 is the wrong
 * answer: it tells a crawler the address is wrong, when the site simply is not open yet.
 *
 * ONE FETCH PER HOST PER WINDOW, not per request. The answer changes only when somebody publishes,
 * and a middleware that called the api on every document would put a round trip in front of every
 * page. The window is short enough that publishing takes effect while the operator is still looking
 * at the screen.
 */
export class SiteVisibilityProxyGuard {
  /** How long a verdict is trusted. Short: this is the delay between pressing Publish and seeing it. */
  private static readonly TTL_MS = 10_000;

  private static readonly cache = new Map<string, { readable: boolean; at: number }>();

  /**
   * Whether this VISITOR may be served this host. Unknown hosts and unreachable apis answer TRUE.
   *
   * Fail OPEN here, deliberately, and only here. This guard's job is to close a site its operator
   * marked private — not to take a site down because a lookup failed. The api is the authority and
   * refuses private content on its own; if this cannot reach it, the request proceeds and the api
   * still says no. Failing closed would mean a blip in one call takes every storefront offline.
   *
   * THE VISITOR IS PART OF THE QUESTION. A site's own people may read it while it is private, and
   * they are recognised by a preview cookie the api validates — so this forwards the cookie and asks
   * rather than deciding, and the cookie is part of the CACHE KEY. Sharing one verdict per host
   * between an operator and a stranger is wrong in both directions: the stranger would inherit the
   * operator's answer and see an unpublished site, and the operator would inherit the stranger's and
   * be locked out of their own.
   */
  static async isReadable(host: string, apiBase: string, previewCookie: string): Promise<boolean> {
    const hostKey = String(host || '').trim().toLowerCase();
    if (!hostKey || !apiBase) return true;

    const cookie = String(previewCookie || '').trim();
    const key = cookie ? `${hostKey}\u0000${await SiteVisibilityProxyGuard.fingerprint(cookie)}` : hostKey;

    const cached = SiteVisibilityProxyGuard.cache.get(key);
    if (cached && Date.now() - cached.at < SiteVisibilityProxyGuard.TTL_MS) return cached.readable;

    const readable = await SiteVisibilityProxyGuard.ask(hostKey, apiBase, cookie);
    SiteVisibilityProxyGuard.cache.set(key, { readable, at: Date.now() });
    return readable;
  }

  private static async ask(host: string, apiBase: string, previewCookie: string): Promise<boolean> {
    try {
      const headers: Record<string, string> = { 'x-forwarded-host': host, host };
      // Only this one cookie is forwarded, by name. Passing the visitor's whole Cookie header would
      // send a storefront session into a call that has no business seeing one.
      if (previewCookie) headers.cookie = `${CookieConstants.SITE_PREVIEW}=${previewCookie}`;

      const response = await fetch(`${apiBase.replace(/\/+$/, '')}/api/v1/system/frontend`, {
        headers,
        cache: 'no-store',
      });
      if (!response.ok) return true;
      const payload = await response.json() as { site?: { isReadable?: unknown; preview?: unknown } | null };
      // No `site` means this deployment serves one site and has no tenants — not an unpublished one.
      if (!payload?.site) return true;
      // Open to everyone, OR open to this caller. `preview` is the api's own answer about the cookie
      // that was just forwarded; this never reads the cookie's contents or decides anything from it.
      return payload.site.isReadable === true || payload.site.preview === true;
    } catch {
      return true;
    }
  }

  /**
   * A cache key for one credential, that is not the credential.
   *
   * Web Crypto rather than node's `createHash`: this class runs inside the storefront's middleware,
   * which is an edge runtime with no node built-ins — importing `crypto` there compiles and then
   * throws on the first request that carries a preview cookie.
   */
  private static async fingerprint(value: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  /** What an unpublished site says. 503, because the site exists and will be there later. */
  static holdingResponse(): Response {
    const body = '<!doctype html><html lang="en"><head><meta charset="utf-8">'
      + '<meta name="viewport" content="width=device-width, initial-scale=1">'
      + '<meta name="robots" content="noindex, nofollow">'
      + '<title>Not published yet</title></head>'
      + '<body style="margin:0;display:grid;place-items:center;min-height:100vh;'
      + 'font:16px/1.5 system-ui,sans-serif;color:#334155;background:#f8fafc">'
      + '<main><p>This site is not published yet.</p></main></body></html>';

    return new Response(body, {
      status: 503,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Retry-After': '3600',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  }
}

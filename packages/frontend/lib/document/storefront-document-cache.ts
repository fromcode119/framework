import { createHash } from 'node:crypto';
import { CookieConstants } from '@fromcode119/core/client';

/** One stored document: the encoded body exactly as it was sent, with the headers that described it. */
interface IStoredDocument {
  body: Uint8Array;
  status: number;
  headers: [string, string][];
}

/**
 * Rendered storefront documents, kept for anonymous visitors.
 *
 * Rendering a page costs about half a second of server time, every time, and every anonymous visitor
 * of a URL gets byte-for-byte the same document. The cache hands that document back while nothing it
 * was built from has changed.
 *
 * WHAT MAKES AN ENTRY STALE — nothing time-based. The key carries:
 *  - the site's content revision (`/system/frontend` → `contentRevision`), which the api bumps on every
 *    write that can reach a page: an order, a booking, a saved collection, a setting;
 *  - a fingerprint of that whole payload, so a theme or plugin update, a visibility change or a
 *    public setting starts new keys by itself;
 *  - the host, the path, the query, the locale cookie and the response encoding.
 *
 * WHO IS NEVER SERVED FROM IT: anyone holding a session or preview cookie, any request with a query
 * beyond the locale parameters (editor sessions, previews and plugin-specific links arrive that way),
 * and any response that is not a plain 200 or 404 document — redirects, holding pages and errors are
 * rendered every time. What a visitor does after the page loads (a cart, a checkout, a booking
 * calendar, a login) happens in the browser against the api and never passes through here.
 *
 * Bounded by size, least-recently-used first out: a busy catalogue cannot grow it without limit.
 */
export class StorefrontDocumentCache {
  /** Response header saying what happened, so a measurement can tell a hit from a render. */
  static readonly STATUS_HEADER = 'X-Fc-Document-Cache';

  private static readonly MAX_BYTES = 32 * 1024 * 1024;

  /** Query parameters that only choose the language, which the key already carries. */
  private static readonly NEUTRAL_PARAMS = new Set(['locale', 'lang']);

  private static readonly entries = new Map<string, IStoredDocument>();

  private static bytes = 0;

  /** A request whose document may be read from, and written to, the cache. */
  static cacheable(method: string, cookieNames: Iterable<string>, searchParams: URLSearchParams): boolean {
    if (method !== 'GET' && method !== 'HEAD') return false;
    const personal = new Set<string>([...CookieConstants.AUTH_COOKIES_TO_CLEAR, CookieConstants.SITE_PREVIEW]);
    for (const name of cookieNames) if (personal.has(name)) return false;
    for (const key of searchParams.keys()) if (!StorefrontDocumentCache.NEUTRAL_PARAMS.has(key)) return false;
    return true;
  }

  /** The key for one URL, as one site, in one language and encoding, at one revision. */
  static key(args: { host: string; pathname: string; searchParams: URLSearchParams; locale: string; encoding: string; frontend: Record<string, unknown> | null }): string | null {
    const revision = String(args.frontend?.contentRevision ?? '');
    if (!revision) return null;
    const fingerprint = createHash('sha1').update(JSON.stringify(args.frontend)).digest('base64url');
    const query = [...args.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('&');
    return [args.host.toLowerCase(), args.pathname, query, args.locale, args.encoding, revision, fingerprint].join('|');
  }

  static read(key: string): Response | null {
    const stored = StorefrontDocumentCache.entries.get(key);
    if (!stored) return null;
    // Re-inserted so the map's order stays least-recently-used first.
    StorefrontDocumentCache.entries.delete(key);
    StorefrontDocumentCache.entries.set(key, stored);
    const headers = new Headers(stored.headers);
    headers.set(StorefrontDocumentCache.STATUS_HEADER, 'hit');
    return new Response(stored.body.slice(), { status: stored.status, headers });
  }

  /** Stores `response` if it is a document worth keeping, and hands back a response to send. */
  static async write(key: string, response: Response): Promise<Response> {
    const status = response.status;
    const headers = new Headers(response.headers);
    if ((status !== 200 && status !== 404) || headers.has('set-cookie') || !String(headers.get('content-type') || '').startsWith('text/html')) {
      headers.set(StorefrontDocumentCache.STATUS_HEADER, 'bypass');
      return new Response(response.body, { status, headers });
    }
    const body = new Uint8Array(await response.arrayBuffer());
    StorefrontDocumentCache.store(key, { body, status, headers: [...headers.entries()] });
    headers.set(StorefrontDocumentCache.STATUS_HEADER, 'miss');
    return new Response(body.slice(), { status, headers });
  }

  /** A response that was not eligible at all, labelled so. */
  static bypass(response: Response): Response {
    const headers = new Headers(response.headers);
    headers.set(StorefrontDocumentCache.STATUS_HEADER, 'bypass');
    return new Response(response.body, { status: response.status, headers });
  }

  private static store(key: string, entry: IStoredDocument): void {
    if (entry.body.byteLength > StorefrontDocumentCache.MAX_BYTES / 8) return;
    const previous = StorefrontDocumentCache.entries.get(key);
    if (previous) StorefrontDocumentCache.bytes -= previous.body.byteLength;
    StorefrontDocumentCache.entries.delete(key);
    StorefrontDocumentCache.entries.set(key, entry);
    StorefrontDocumentCache.bytes += entry.body.byteLength;
    for (const [oldest, stored] of StorefrontDocumentCache.entries) {
      if (StorefrontDocumentCache.bytes <= StorefrontDocumentCache.MAX_BYTES) break;
      StorefrontDocumentCache.entries.delete(oldest);
      StorefrontDocumentCache.bytes -= stored.body.byteLength;
    }
  }

  /** Test seam. */
  static reset(): void {
    StorefrontDocumentCache.entries.clear();
    StorefrontDocumentCache.bytes = 0;
  }
}

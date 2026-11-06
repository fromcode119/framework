import { FrontendConfigCache } from '@/lib/frontend-config-cache';
import { RequestScope } from '@/lib/request-scope';
import { PayloadFingerprint } from '@/lib/payload-fingerprint';

/**
 * Site-wide payloads kept ACROSS requests while the site's content revision stays the same.
 *
 * The api is one process. Every storefront render asked it again for the same dictionary, the same
 * navigation menus and the same head data, and those calls queued behind each other and behind the
 * page's own resolve: about half of every render's server time was spent re-reading what had not
 * changed since the previous visitor.
 *
 * WHAT MAKES AN ENTRY STALE — the same terms as the rendered-document cache (StorefrontDocumentCache),
 * nothing time-based. The key carries the site's `contentRevision`, which the api bumps on every write
 * that can reach a page (a saved collection, a setting, a plugin's own table, a purge), and a
 * fingerprint of the whole `/system/frontend` payload, so a theme or plugin update, a visibility
 * change or a public setting starts new keys by themselves. That payload is still read on every
 * request — it is what says whether anything changed.
 *
 * WHO IS SERVED FROM IT: only a request the document route opened as anonymous, keyed by its origin (no session or preview
 * cookie, no query beyond the locale), because the server fetches forward the visitor's cookies and a
 * signed-in answer may be personal. Every other request runs the fetch as before, memoised per request.
 * A failed fetch is never kept. Bounded: least recently used first out.
 */
export class SiteRevisionMemo {
  private static readonly MAX_ENTRIES = 256;
  private static readonly entries = new Map<string, Promise<unknown>>();
  private static nextFunctionId = 0;

  static memo<A extends (string | number | boolean)[], R>(fn: (...args: A) => Promise<R>): (...args: A) => Promise<R> {
    const id = `f${++SiteRevisionMemo.nextFunctionId}`;
    const perRequest = RequestScope.memo(fn);
    return async (...args: A): Promise<R> => {
      const shareKey = RequestScope.shareKey();
      if (!shareKey) return perRequest(...args);
      const revision = await SiteRevisionMemo.revisionKey();
      if (!revision) return perRequest(...args);
      const key = [id, shareKey, revision, ...args.map((arg) => `${typeof arg}:${String(arg)}`)].join('\u0000');
      const kept = SiteRevisionMemo.entries.get(key) as Promise<R> | undefined;
      if (kept) {
        SiteRevisionMemo.entries.delete(key);
        SiteRevisionMemo.entries.set(key, kept);
        return kept;
      }
      const pending = perRequest(...args);
      SiteRevisionMemo.entries.set(key, pending);
      pending.catch(() => {
        if (SiteRevisionMemo.entries.get(key) === pending) SiteRevisionMemo.entries.delete(key);
      });
      while (SiteRevisionMemo.entries.size > SiteRevisionMemo.MAX_ENTRIES) {
        const oldest = SiteRevisionMemo.entries.keys().next().value as string;
        SiteRevisionMemo.entries.delete(oldest);
      }
      return pending;
    };
  }

  /** `contentRevision` + a fingerprint of this request's `/system/frontend` payload; '' when it carries none. */
  static async revisionKey(): Promise<string> {
    const config = await FrontendConfigCache.read();
    const revision = String(config?.contentRevision ?? '');
    if (!config || !revision) return '';
    return `${revision}|${PayloadFingerprint.of(config)}`;
  }

  /** Test seam. */
  static reset(): void {
    SiteRevisionMemo.entries.clear();
  }
}

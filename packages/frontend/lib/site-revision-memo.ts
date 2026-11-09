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
  /**
   * Bounded per memoised function AND per site, then in total. One shared list of 256 let a crawl of one
   * site's product pages — or of any other site on the platform — push out every other site's dictionary,
   * menus and head data, so a page visited a minute earlier fetched them all again (80–140 ms more).
   */
  private static readonly MAX_PER_PARTITION = 256;
  private static readonly MAX_ENTRIES = 1024;
  /** Partitions are keyed by the request's origin, which a client chooses: their number is bounded too. */
  private static readonly MAX_PARTITIONS = 128;
  /** Partition (function + site) → its entries, both in least-recently-used-first order. */
  private static readonly partitions = new Map<string, Map<string, Promise<unknown>>>();
  private static size = 0;
  private static nextFunctionId = 0;

  /**
   * `keep` decides, once the answer is in, whether it may serve later requests; an answer it refuses
   * is dropped, so the next request asks again (a 404 lookup must reach the api every time to be logged).
   */
  static memo<A extends (string | number | boolean)[], R>(
    fn: (...args: A) => Promise<R>,
    keep: (value: R) => boolean = () => true,
  ): (...args: A) => Promise<R> {
    const id = `f${++SiteRevisionMemo.nextFunctionId}`;
    const perRequest = RequestScope.memo(fn);
    return async (...args: A): Promise<R> => {
      const shareKey = RequestScope.shareKey();
      if (!shareKey) return perRequest(...args);
      const revision = await SiteRevisionMemo.revisionKey();
      if (!revision) return perRequest(...args);
      const key = [revision, ...args.map((arg) => `${typeof arg}:${String(arg)}`)].join('\u0000');
      const partitionKey = `${id}\u0000${shareKey}`;
      const partition = SiteRevisionMemo.touch(partitionKey);
      const kept = partition.get(key) as Promise<R> | undefined;
      if (kept) {
        partition.delete(key);
        partition.set(key, kept);
        return kept;
      }
      const pending = perRequest(...args);
      partition.set(key, pending);
      SiteRevisionMemo.size++;
      const drop = () => {
        if (partition.get(key) !== pending) return;
        partition.delete(key);
        SiteRevisionMemo.size--;
        if (!partition.size && SiteRevisionMemo.partitions.get(partitionKey) === partition) SiteRevisionMemo.partitions.delete(partitionKey);
      };
      pending.then((value) => { if (!keep(value)) drop(); }, drop);
      SiteRevisionMemo.evict(partition);
      return pending;
    };
  }

  /** The partition, moved to most recently used. */
  private static touch(partitionKey: string): Map<string, Promise<unknown>> {
    const partition = SiteRevisionMemo.partitions.get(partitionKey) ?? new Map<string, Promise<unknown>>();
    SiteRevisionMemo.partitions.delete(partitionKey);
    SiteRevisionMemo.partitions.set(partitionKey, partition);
    return partition;
  }

  /** Oldest first: inside the partition past its own bound, then from the least recently used partition. */
  private static evict(partition: Map<string, Promise<unknown>>): void {
    while (partition.size > SiteRevisionMemo.MAX_PER_PARTITION) SiteRevisionMemo.dropOldest(partition);
    while (SiteRevisionMemo.partitions.size > SiteRevisionMemo.MAX_PARTITIONS) {
      const [partitionKey, oldest] = SiteRevisionMemo.partitions.entries().next().value as [string, Map<string, Promise<unknown>>];
      SiteRevisionMemo.size -= oldest.size;
      SiteRevisionMemo.partitions.delete(partitionKey);
    }
    for (const [partitionKey, oldest] of SiteRevisionMemo.partitions) {
      if (SiteRevisionMemo.size <= SiteRevisionMemo.MAX_ENTRIES) break;
      while (oldest.size && SiteRevisionMemo.size > SiteRevisionMemo.MAX_ENTRIES) SiteRevisionMemo.dropOldest(oldest);
      if (!oldest.size) SiteRevisionMemo.partitions.delete(partitionKey);
    }
  }

  private static dropOldest(partition: Map<string, Promise<unknown>>): void {
    const oldest = partition.keys().next().value as string;
    partition.delete(oldest);
    SiteRevisionMemo.size--;
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
    SiteRevisionMemo.partitions.clear();
    SiteRevisionMemo.size = 0;
  }
}

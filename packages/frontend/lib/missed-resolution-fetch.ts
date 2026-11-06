import { SiteRevisionMemo } from '@/lib/site-revision-memo';
import { headers } from 'next/headers';
import { ServerApiPaths } from '@/lib/server-api/server-api-paths';
import { ServerApiUtils } from '@/lib/server-api/server-api';

/**
 * The final `/system/resolve` lookup before a storefront answers 404. It forwards the VISITOR's
 * referrer and browser, which the server-side fetch would otherwise replace with the storefront
 * server's own, so the API can report the miss as the visitor made it.
 *
 * Every document render goes through it, so an answer that FOUND something is shared across anonymous
 * requests while the content revision holds (SiteRevisionMemo); a miss is never kept, because each one
 * must reach the api to be logged.
 */
export class MissedResolutionFetch {
  static readonly fetch = SiteRevisionMemo.memo(async (queryString: string): Promise<Record<string, any> | null> => {
    const path = ServerApiPaths.buildSystemResolvePath(queryString);
    const visitor = await headers();
    const visitorHeaders: Record<string, string> = {};
    const referer = String(visitor.get('referer') || '').trim();
    const userAgent = String(visitor.get('user-agent') || '').trim();
    if (referer) visitorHeaders.referer = referer;
    if (userAgent) visitorHeaders['user-agent'] = userAgent;
    const response = (await ServerApiUtils.serverFetchResponseOutcome(path, { headers: visitorHeaders })).valueOrThrow(path);
    if (!response || !response.ok) return null;
    return await response.json() as Record<string, any>;
  }, (result) => Boolean(result?.doc));
}

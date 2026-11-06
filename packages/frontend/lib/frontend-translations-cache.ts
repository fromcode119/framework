import { SiteRevisionMemo } from '@/lib/site-revision-memo';
import { ServerApiPaths } from '@/lib/server-api/server-api-paths';

import { ServerApiUtils } from '@/lib/server-api/server-api';

/**
 * Memoized `/system/i18n?locale=…` payload (`RequestScope.memo`), keyed by locale — the same
 * dictionary the browser provider loads once it boots.
 *
 * Server-rendering a theme needs it: the layout chrome (nav labels, buttons, footer headings) is all
 * `t()` calls, and resolving them against an empty dictionary would paint raw keys that then change
 * on hydration. Kept across anonymous requests at the site's current revision (`SiteRevisionMemo`);
 * per request otherwise.
 */
export class FrontendTranslationsCache {
  private static readonly translationsCache = SiteRevisionMemo.memo(async (locale: string): Promise<Record<string, unknown>> => {
    const payload = await ServerApiUtils.serverFetchJson(ServerApiPaths.buildSystemI18nPath(locale));
    return payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  });

  static async read(locale: string): Promise<Record<string, unknown>> {
    return FrontendTranslationsCache.translationsCache(String(locale || '').trim().toLowerCase() || 'en');
  }
}

import { cache } from 'react';

import { ServerApiUtils } from '@/lib/server-api';

/**
 * Per-request memoized `/system/i18n?locale=…` payload (React `cache()`), keyed by locale — the same
 * dictionary the browser provider loads once it boots.
 *
 * Server-rendering a theme needs it: the layout chrome (nav labels, buttons, footer headings) is all
 * `t()` calls, and resolving them against an empty dictionary would paint raw keys that then change
 * on hydration. Mirrors `FrontendConfigCache`: per-request only, nothing persists across requests.
 */
export class FrontendTranslationsCache {
  private static readonly translationsCache = cache(async (locale: string): Promise<Record<string, unknown>> => {
    const payload = await ServerApiUtils.serverFetchJson(ServerApiUtils.buildSystemI18nPath(locale));
    return payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  });

  static async read(locale: string): Promise<Record<string, unknown>> {
    return FrontendTranslationsCache.translationsCache(String(locale || '').trim().toLowerCase() || 'en');
  }
}

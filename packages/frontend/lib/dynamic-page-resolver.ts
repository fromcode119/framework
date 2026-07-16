import { cache } from 'react';
import { LocalizationUtils } from '@fromcode119/core/client';
import { FrontendPublicSettings } from './frontend-public-settings';
import { FrontendLocaleService } from './frontend-locale-service';
import { ServerApiUtils } from './server-api';
import { QueryParamUtils } from './query-param-utils';
import { ResolvedContentShape } from './resolved-content-shape';
import type { SearchParams, LocaleStrategy, ResolvedDocResult } from './dynamic-page-resolver.types';

export class DynamicPageResolver {
  /**
   * Per-request memoized `/system/resolve` fetch (React `cache()`), keyed by the
   * FULL query string (slug + locale + fallback_locale + preview) — a primitive key,
   * so `generateMetadata` and the page body dedupe to ONE API round-trip for the
   * identical query (storefront-performance-audit.md §1.2 / Phase 1.2). Per-request
   * only: nothing persists across requests, and the underlying fetch still forwards
   * the visitor's auth cookie and keeps `no-store`, so members-only gating is
   * evaluated with the visitor's identity exactly as before.
   */
  private static readonly resolveFetchCache = cache(async (queryString: string): Promise<Record<string, any> | null> => {
    const response = await ServerApiUtils.serverFetchResponse(ServerApiUtils.buildSystemResolvePath(queryString));
    if (!response || !response.ok) return null;
    return await response.json() as Record<string, any>;
  });

  static async readSettingValue(key: string): Promise<string> {
    return FrontendPublicSettings.readSettingValue(key);
  }

  static async getLocaleRoutingConfig(): Promise<{ strategy: LocaleStrategy; enabledLocales: Set<string> }> {
    const [strategyValue, enabledLocalesValue, localizationLocalesValue] = await Promise.all([
      DynamicPageResolver.readSettingValue('locale_url_strategy'),
      DynamicPageResolver.readSettingValue('enabled_locales'),
      DynamicPageResolver.readSettingValue('localization_locales'),
    ]);

    const strategy: LocaleStrategy = (['query', 'path', 'none'] as const).includes(strategyValue as any)
      ? (strategyValue as LocaleStrategy)
      : 'query';

    const enabledLocales = new Set<string>();
    String(enabledLocalesValue || '')
      .split(',')
      .map((item) => LocalizationUtils.normalizeLocaleCode(item))
      .filter(Boolean)
      .forEach((code) => enabledLocales.add(code));

    if (localizationLocalesValue) {
      try {
        const parsed = JSON.parse(localizationLocalesValue);
        if (Array.isArray(parsed)) {
          parsed.forEach((entry: any) => {
            const code = LocalizationUtils.normalizeLocaleCode(entry?.code || entry?.isoCode || entry?.locale);
            if (!code) return;
            if (entry?.enabled === false) return;
            enabledLocales.add(code);
          });
        }
      } catch {
        // no-op
      }
    }

    if (!enabledLocales.size) enabledLocales.add('en');
    return { strategy, enabledLocales };
  }

  static async resolveLocale(
    searchParams: SearchParams | undefined,
    pathLocale: string | undefined,
    strategy: LocaleStrategy,
  ): Promise<string> {
    return FrontendLocaleService.resolveLocale(searchParams, pathLocale, strategy);
  }

  static async resolveDoc(
    slug: string,
    searchParams: SearchParams | undefined,
    localeOverride: string | undefined,
    strategy: LocaleStrategy,
  ): Promise<any | null> {
    const result = await DynamicPageResolver.resolveDocResult(slug, searchParams, localeOverride, strategy);
    return result?.doc || null;
  }

  static async resolveDocResult(
    slug: string,
    searchParams: SearchParams | undefined,
    localeOverride: string | undefined,
    strategy: LocaleStrategy,
  ): Promise<ResolvedDocResult | null> {
    const query = new URLSearchParams();
    query.set('slug', slug);
    const locale = await DynamicPageResolver.resolveLocale(searchParams, localeOverride, strategy);
    const fallbackLocale = LocalizationUtils.normalizeLocaleCode(QueryParamUtils.readSearchValue(searchParams, 'fallback_locale'));
    if (locale) query.set('locale', locale);
    if (fallbackLocale) query.set('fallback_locale', fallbackLocale);
    if (QueryParamUtils.isPreviewMode(searchParams)) query.set('preview', '1');

    const result = await DynamicPageResolver.resolveFetchCache(query.toString());
    if (!result) return null;

    return {
      type: String(result?.type || '').trim(),
      plugin: String(result?.plugin || '').trim(),
      doc: ResolvedContentShape.normalize((result?.doc as Record<string, unknown> | null) || null),
    };
  }

  /**
   * Looks up a configured redirect rule for a would-be-404 path via the framework's OWN resolve endpoint.
   * The framework's route resolver consults a plugin-agnostic redirect registry (an SEO plugin, a CMS
   * table, … register into it) and returns a `redirect` resolution — so the frontend never names a plugin.
   * Returns the target + whether it's permanent (308) or temporary (307), or null when no rule matches.
   * Failures resolve to null so a lookup error never breaks the page.
   */
  static async resolveRedirect(slug: string): Promise<{ target: string; permanent: boolean } | null> {
    try {
      const query = new URLSearchParams();
      query.set('slug', String(slug || '').replace(/^\/+/, ''));
      const result = await DynamicPageResolver.resolveFetchCache(query.toString()) as
        { type?: string; redirect?: { target?: string; permanent?: boolean } } | null;
      if (result?.type === 'redirect' && result.redirect?.target) {
        return { target: String(result.redirect.target), permanent: result.redirect.permanent !== false };
      }
    } catch {
      /* lookup failed — fall through to the normal 404 */
    }
    return null;
  }

  static async resolveDocWithPermalinkFallback(
    slug: string,
    searchParams: SearchParams | undefined,
    localeOverride: string | undefined,
    strategy: LocaleStrategy,
  ): Promise<any | null> {
    const result = await DynamicPageResolver.resolveDocWithPermalinkFallbackResult(slug, searchParams, localeOverride, strategy);
    return result?.doc || null;
  }

  static async resolveDocWithPermalinkFallbackResult(
    slug: string,
    searchParams: SearchParams | undefined,
    localeOverride: string | undefined,
    strategy: LocaleStrategy,
  ): Promise<ResolvedDocResult | null> {
    const cleanSlug = String(slug || '').trim().replace(/^\/+/, '');
    if (!cleanSlug) return null;

    const doc = await DynamicPageResolver.resolveDocResult(cleanSlug, searchParams, localeOverride, strategy);
    if (doc?.doc) return doc;

    // Lead-slash fallback: helps matching records where permalink was stored WITH a slash.
    return DynamicPageResolver.resolveDocResult(`/${cleanSlug}`, searchParams, localeOverride, strategy);
  }

  static async resolveBySlug(
    slug: string,
    locale: string,
    fallbackLocale: string,
    searchParams?: SearchParams,
  ): Promise<any | null> {
    const query = new URLSearchParams();
    query.set('slug', slug);
    if (locale) query.set('locale', locale);
    if (fallbackLocale) query.set('fallback_locale', fallbackLocale);
    if (QueryParamUtils.isPreviewMode(searchParams)) query.set('preview', '1');

    const result = await DynamicPageResolver.resolveFetchCache(query.toString());
    return ResolvedContentShape.normalize((result?.doc as Record<string, unknown> | null) || null);
  }

  static async resolveBySlugResult(
    slug: string,
    locale: string,
    fallbackLocale: string,
    searchParams?: SearchParams,
  ): Promise<ResolvedDocResult | null> {
    const query = new URLSearchParams();
    query.set('slug', slug);
    if (locale) query.set('locale', locale);
    if (fallbackLocale) query.set('fallback_locale', fallbackLocale);
    if (QueryParamUtils.isPreviewMode(searchParams)) query.set('preview', '1');

    const result = await DynamicPageResolver.resolveFetchCache(query.toString());
    return {
      type: String(result?.type || '').trim(),
      plugin: String(result?.plugin || '').trim(),
      doc: ResolvedContentShape.normalize((result?.doc as Record<string, unknown> | null) || null),
    };
  }

  private static isHomeCandidate(result: ResolvedDocResult | null): boolean {
    if (!result?.doc) {
      return false;
    }

    return Boolean(
      ResolvedContentShape.resolveSlug(result.doc)
      || ResolvedContentShape.resolveTitle(result.doc)
      || ResolvedContentShape.resolveLayoutName(result.doc)
      || ResolvedContentShape.hasRenderableContent(result.doc)
    );
  }

  static async resolveHomeTarget(
    locale: string,
    fallbackLocale: string,
    searchParams?: SearchParams,
  ): Promise<{ content: any | null; forcedLayout: string | null; resolution: ResolvedDocResult | null }> {
    const target = (await DynamicPageResolver.readSettingValue('routing_home_target')) || 'auto';

    if (target.startsWith('layout:')) {
      const forcedLayout = target.slice('layout:'.length).trim();
      return { content: null, forcedLayout: forcedLayout || null, resolution: null };
    }

    if (target.startsWith('collection:')) {
      const parts = target.split(':');
      const collectionSlug = parts[1];
      const recordId = parts.slice(2).join(':');
      if (collectionSlug && recordId) {
        const result = await ServerApiUtils.serverFetchJson(ServerApiUtils.buildCollectionLookupPath(collectionSlug, { id: recordId, limit: 1 }));
        const doc = ServerApiUtils.extractFirstDoc(result);
        if (doc) {
          const normalized = ResolvedContentShape.normalize(doc as Record<string, unknown>);
          return { content: normalized, forcedLayout: null, resolution: { type: '', plugin: '', doc: normalized } };
        }
      }
    }

    const byRoot = await DynamicPageResolver.resolveBySlugResult('/', locale, fallbackLocale, searchParams);
    if (DynamicPageResolver.isHomeCandidate(byRoot)) {
      return { content: byRoot?.doc || null, forcedLayout: null, resolution: byRoot };
    }

    const byHome = await DynamicPageResolver.resolveBySlugResult('home', locale, fallbackLocale, searchParams);
    if (DynamicPageResolver.isHomeCandidate(byHome)) {
      return { content: byHome?.doc || null, forcedLayout: null, resolution: byHome };
    }

    return { content: null, forcedLayout: null, resolution: null };
  }
}

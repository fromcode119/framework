import { cookies } from 'next/headers';
import { CookieConstants, LocalizationUtils } from '@fromcode119/core/client';
import { FrontendPublicSettings } from './frontend-public-settings';
import { ServerApiUtils } from './server-api';
import { QueryParamUtils } from './query-param-utils';
import { ResolvedContentShape } from './resolved-content-shape';
import type { SearchParams, LocaleStrategy, ResolvedDocResult } from './dynamic-page-resolver.types';

export class DynamicPageResolver {
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
    const normalizedPathLocale = LocalizationUtils.normalizeLocaleCode(pathLocale || '');
    if (normalizedPathLocale) return normalizedPathLocale;
    if (strategy === 'query') {
      const fromQuery = LocalizationUtils.normalizeLocaleCode(
        QueryParamUtils.readSearchValue(searchParams, 'locale') || QueryParamUtils.readSearchValue(searchParams, 'lang'),
      );
      if (fromQuery) return fromQuery;
    }
    const cookieStore = await cookies();
    const fromCookie = LocalizationUtils.normalizeLocaleCode(cookieStore.get(CookieConstants.LOCALE)?.value || '');
    return fromCookie || '';
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

    const response = await ServerApiUtils.serverFetchResponse(ServerApiUtils.buildSystemResolvePath(query));
    if (!response || !response.ok) return null;

    const result = await response.json();
    return {
      type: String(result?.type || '').trim(),
      plugin: String(result?.plugin || '').trim(),
      doc: ResolvedContentShape.normalize((result?.doc as Record<string, unknown> | null) || null),
    };
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

    const result = await ServerApiUtils.serverFetchJson(ServerApiUtils.buildSystemResolvePath(query)) as Record<string, any>;
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

    const result = await ServerApiUtils.serverFetchJson(ServerApiUtils.buildSystemResolvePath(query)) as Record<string, unknown>;
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
  ): Promise<{ content: any | null; forcedLayout: string | null }> {
    const target = (await DynamicPageResolver.readSettingValue('routing_home_target')) || 'auto';

    if (target.startsWith('layout:')) {
      const forcedLayout = target.slice('layout:'.length).trim();
      return { content: null, forcedLayout: forcedLayout || null };
    }

    if (target.startsWith('collection:')) {
      const parts = target.split(':');
      const collectionSlug = parts[1];
      const recordId = parts.slice(2).join(':');
      if (collectionSlug && recordId) {
        const result = await ServerApiUtils.serverFetchJson(ServerApiUtils.buildCollectionLookupPath(collectionSlug, { id: recordId, limit: 1 }));
        const doc = ServerApiUtils.extractFirstDoc(result);
        if (doc) return { content: ResolvedContentShape.normalize(doc as Record<string, unknown>), forcedLayout: null };
      }
    }

    const byRoot = await DynamicPageResolver.resolveBySlugResult('/', locale, fallbackLocale, searchParams);
    if (DynamicPageResolver.isHomeCandidate(byRoot)) {
      return { content: byRoot?.doc || null, forcedLayout: null };
    }

    const byHome = await DynamicPageResolver.resolveBySlugResult('home', locale, fallbackLocale, searchParams);
    if (DynamicPageResolver.isHomeCandidate(byHome)) {
      return { content: byHome?.doc || null, forcedLayout: null };
    }

    return { content: null, forcedLayout: null };
  }
}

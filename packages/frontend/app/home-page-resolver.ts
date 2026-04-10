import { CookieConstants, LocalizationUtils } from '@fromcode119/core/client';
import { cookies } from 'next/headers';
import { ServerApiUtils } from '@/lib/server-api';
import { QueryParamUtils } from '@/lib/query-param-utils';
import type { ResolvedDocResult } from '@/lib/dynamic-page-resolver.types';
import type { HomeTargetResolution, LocaleUrlStrategy, MaybePromise, SearchParams } from './home-page.types';

export class HomePageResolver {
  static async resolve(searchParams?: MaybePromise<SearchParams>): Promise<HomeTargetResolution> {
    const resolvedSearchParams = await QueryParamUtils.resolveSearchParams(searchParams);
    const localeStrategy = await this.getLocaleUrlStrategy();
    const locale = await this.resolveLocale(resolvedSearchParams, localeStrategy);
    const fallbackLocale = LocalizationUtils.normalizeLocaleCode(QueryParamUtils.readSearchValue(resolvedSearchParams, 'fallback_locale'));

    return await this.resolveHomeTarget(locale, fallbackLocale);
  }

  private static async readSettingValue(key: string): Promise<string> {
    const map = await this.readSettingsMap();
    return String(map.get(key) || '').trim();
  }

  private static async readSettingsMap(): Promise<Map<string, string>> {
    const result = await ServerApiUtils.serverFetchJson(ServerApiUtils.buildSettingsCollectionPath(500)) as Record<string, unknown>;
    const docs = Array.isArray(result?.docs)
      ? result.docs
      : Array.isArray(result)
        ? result
        : [];

    const map = new Map<string, string>();
    for (const doc of docs) {
      const row = doc as Record<string, unknown>;
      const key = String(row?.key || '').trim();
      if (!key) {
        continue;
      }
      map.set(key, String(row?.value ?? '').trim());
    }
    return map;
  }

  private static async getLocaleUrlStrategy(): Promise<LocaleUrlStrategy> {
    const value = (await this.readSettingValue('locale_url_strategy')).toLowerCase();
    if (value === 'path' || value === 'none') {
      return value;
    }
    return 'query';
  }

  private static async resolveLocale(searchParams: SearchParams | undefined, strategy: LocaleUrlStrategy): Promise<string> {
    if (strategy === 'query') {
      const fromQuery = LocalizationUtils.normalizeLocaleCode(
        QueryParamUtils.readSearchValue(searchParams, 'locale') || QueryParamUtils.readSearchValue(searchParams, 'lang')
      );
      if (fromQuery) {
        return fromQuery;
      }
    }

    const cookieStore = await cookies();
    const fromCookie = LocalizationUtils.normalizeLocaleCode(cookieStore.get(CookieConstants.LOCALE)?.value || '');
    return fromCookie || '';
  }

  private static async resolveBySlug(slug: string, locale: string, fallbackLocale: string): Promise<unknown> {
    const result = await this.resolveBySlugResult(slug, locale, fallbackLocale);
    return result?.doc || null;
  }

  static async resolveBySlugResult(slug: string, locale: string, fallbackLocale: string): Promise<ResolvedDocResult | null> {
    const query = new URLSearchParams();
    query.set('slug', slug);
    if (locale) {
      query.set('locale', locale);
    }
    if (fallbackLocale) {
      query.set('fallback_locale', fallbackLocale);
    }

    const result = await ServerApiUtils.serverFetchJson(ServerApiUtils.buildSystemResolvePath(query)) as Record<string, unknown>;
    return {
      type: String(result?.type || '').trim(),
      plugin: String(result?.plugin || '').trim(),
      doc: (result?.doc as Record<string, unknown> | null) || null,
    };
  }

  private static async resolveHomeTarget(locale: string, fallbackLocale: string): Promise<HomeTargetResolution> {
    const target = (await this.readSettingValue('routing_home_target')) || 'auto';

    if (target.startsWith('layout:')) {
      const forcedLayout = target.slice('layout:'.length).trim();
      return { content: null, forcedLayout: forcedLayout || null, resolution: null };
    }

    if (target.startsWith('collection:')) {
      const parts = target.split(':');
      const collectionSlug = parts[1];
      const recordId = parts.slice(2).join(':');

      if (collectionSlug && recordId) {
        const result = await ServerApiUtils.serverFetchJson(
          ServerApiUtils.buildCollectionLookupPath(collectionSlug, { id: recordId, limit: 1 })
        );
        const doc = ServerApiUtils.extractFirstDoc(result);
        if (doc) {
          return {
            content: doc,
            forcedLayout: null,
            resolution: {
              type: this.resolveCollectionTargetType(doc as Record<string, unknown>, collectionSlug),
              plugin: '',
              doc: doc as Record<string, unknown>,
            },
          };
        }
      }
    }

    const byRoot = await this.resolveBySlugResult('/', locale, fallbackLocale);
    if (byRoot?.doc) {
      return { content: byRoot.doc, forcedLayout: null, resolution: byRoot };
    }

    const byHome = await this.resolveBySlugResult('home', locale, fallbackLocale);
    if (byHome?.doc) {
      return { content: byHome.doc, forcedLayout: null, resolution: byHome };
    }

    return { content: null, forcedLayout: null, resolution: null };
  }

  private static resolveCollectionTargetType(doc: Record<string, unknown>, collectionSlug: string): string {
    const explicitType = String(doc?.contentType || doc?.type || '').trim().toLowerCase();
    if (explicitType) {
      return explicitType;
    }

    const normalized = String(collectionSlug || '').trim().toLowerCase();
    if (normalized.endsWith('s') && normalized.length > 1) {
      return normalized.slice(0, -1);
    }
    return normalized;
  }
}

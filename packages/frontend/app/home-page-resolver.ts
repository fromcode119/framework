import { LocalizationUtils } from '@fromcode119/sdk';
import { cookies } from 'next/headers';
import { ServerApiUtils } from '@/lib/server-api';
import { QueryParamUtils } from '@/lib/query-param-utils';
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
    const fromCookie = LocalizationUtils.normalizeLocaleCode(cookieStore.get('fc_locale')?.value || '');
    return fromCookie || '';
  }

  private static async resolveBySlug(slug: string, locale: string, fallbackLocale: string): Promise<unknown> {
    const query = new URLSearchParams();
    query.set('slug', slug);
    if (locale) {
      query.set('locale', locale);
    }
    if (fallbackLocale) {
      query.set('fallback_locale', fallbackLocale);
    }

    const result = await ServerApiUtils.serverFetchJson(ServerApiUtils.buildSystemResolvePath(query)) as Record<string, unknown>;
    return result?.doc || null;
  }

  private static async resolveHomeTarget(locale: string, fallbackLocale: string): Promise<HomeTargetResolution> {
    const target = (await this.readSettingValue('routing_home_target')) || 'auto';

    if (target.startsWith('layout:')) {
      const forcedLayout = target.slice('layout:'.length).trim();
      return { content: null, forcedLayout: forcedLayout || null };
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
          return { content: doc, forcedLayout: null };
        }
      }
    }

    const byRoot = await this.resolveBySlug('/', locale, fallbackLocale);
    if (byRoot) {
      return { content: byRoot, forcedLayout: null };
    }

    const byHome = await this.resolveBySlug('home', locale, fallbackLocale);
    if (byHome) {
      return { content: byHome, forcedLayout: null };
    }

    return { content: null, forcedLayout: null };
  }
}

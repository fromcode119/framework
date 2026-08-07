import { LocalizationUtils } from '@fromcode119/core/client';
import { FrontendLocaleService } from '@/lib/frontend-locale-service';
import { ResolvedContentShape } from '@/lib/resolved-content-shape';
import { FrontendPublicSettings } from '@/lib/frontend-public-settings';
import { ServerApiUtils } from '@/lib/server-api';
import { QueryParamUtils } from '@/lib/query-param-utils';
import { IResolvedDocResult } from '@/lib/interfaces/resolved-doc-result.interface';
import { IHomeTargetResolution } from '@/app/interfaces/home-target-resolution.interface';
import { LocaleUrlStrategy } from '@fromcode119/core/client';

export class HomePageResolver {
  static async resolve(searchParams?: (Record<string, string | string[] | undefined> | Promise<Record<string, string | string[] | undefined>>)): Promise<IHomeTargetResolution> {
    const resolvedSearchParams = await QueryParamUtils.resolveSearchParams(searchParams);
    const localeStrategy = await this.getLocaleUrlStrategy();
    const locale = await this.resolveLocale(resolvedSearchParams, localeStrategy);
    const fallbackLocale = LocalizationUtils.normalizeLocaleCode(QueryParamUtils.readSearchValue(resolvedSearchParams, 'fallback_locale'));

    return await this.resolveHomeTarget(locale, fallbackLocale);
  }

  private static async readSettingValue(key: string): Promise<string> {
    return FrontendPublicSettings.readSettingValue(key);
  }

  private static async getLocaleUrlStrategy(): Promise<LocaleUrlStrategy> {
    const value = (await this.readSettingValue('locale_url_strategy')).toLowerCase();
    return LocaleUrlStrategy.resolve(value);
  }

  private static async resolveLocale(searchParams: Record<string, string | string[] | undefined> | undefined, strategy: LocaleUrlStrategy): Promise<string> {
    return FrontendLocaleService.resolveLocale(searchParams, '', strategy);
  }

  private static async resolveBySlug(slug: string, locale: string, fallbackLocale: string): Promise<unknown> {
    const result = await this.resolveBySlugResult(slug, locale, fallbackLocale);
    return result?.doc || null;
  }

  static async resolveBySlugResult(slug: string, locale: string, fallbackLocale: string): Promise<IResolvedDocResult | null> {
    const query = new URLSearchParams();
    query.set('slug', slug);
    if (locale) {
      query.set('locale', locale);
    }
    if (fallbackLocale) {
      query.set('fallback_locale', fallbackLocale);
    }

    // Strict: an unreachable API must not be rendered as "the home page does not exist".
    const path = ServerApiUtils.buildSystemResolvePath(query);
    const result = (await ServerApiUtils.serverFetchJsonOutcome(path)).valueOrThrow(path) as Record<string, unknown>;
    return {
      type: String(result?.type || '').trim(),
      plugin: String(result?.plugin || '').trim(),
      doc: ResolvedContentShape.normalize((result?.doc as Record<string, unknown> | null) || null),
    };
  }

  private static isHomeCandidate(result: IResolvedDocResult | null): boolean {
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

  private static async resolveHomeTarget(locale: string, fallbackLocale: string): Promise<IHomeTargetResolution> {
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
          const normalizedDoc = ResolvedContentShape.normalize(doc as Record<string, unknown>);
          return {
            content: normalizedDoc,
            forcedLayout: null,
            resolution: {
              type: this.resolveCollectionTargetType(normalizedDoc || {}, collectionSlug),
              plugin: '',
              doc: normalizedDoc,
            },
          };
        }
      }
    }

    const byRoot = await this.resolveBySlugResult('/', locale, fallbackLocale);
    if (this.isHomeCandidate(byRoot)) {
      return { content: byRoot?.doc || null, forcedLayout: null, resolution: byRoot };
    }

    const byHome = await this.resolveBySlugResult('home', locale, fallbackLocale);
    if (this.isHomeCandidate(byHome)) {
      return { content: byHome?.doc || null, forcedLayout: null, resolution: byHome };
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

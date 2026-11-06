import { RequestScope } from '@/lib/request-scope';
import { ServerApiPaths } from '@/lib/server-api/server-api-paths';

import { AccountRouteUtils, LocalizationUtils } from '@fromcode119/core/client';
import { FrontendPublicSettings } from '@/lib/frontend-public-settings';
import { FrontendLocaleService } from '@/lib/frontend-locale-service';
import { ServerApiUtils } from '@/lib/server-api/server-api';
import { QueryParamUtils } from '@/lib/query-param-utils';
import { ResolvedContentShape } from '@/lib/resolved-content-shape';
import { LocaleUrlStrategy } from '@fromcode119/core/client';
import { IResolvedDocResult } from '@/lib/interfaces/resolved-doc-result.interface';
import { ServerApiUnreachableError } from '@/lib/server-api-unreachable-error';
import { MissedResolutionFetch } from '@/lib/missed-resolution-fetch';
import { StorefrontMissRedirect } from '@/lib/storefront-miss-redirect';
import type { IStorefrontRedirectRule } from '@/lib/interfaces/storefront-redirect-rule.interface';

export class DynamicPageResolver {
  /**
   * Per-request memoized `/system/resolve` fetch (`RequestScope.memo`), keyed by the
   * FULL query string (slug + locale + fallback_locale + preview) — a primitive key,
   * so `generateMetadata` and the page body dedupe to ONE API round-trip for the
   * identical query (storefront-performance-audit.md §1.2 / Phase 1.2). Per-request
   * only: nothing persists across requests, and the underlying fetch still forwards
   * the visitor's auth cookie and keeps `no-store`, so members-only gating is
   * evaluated with the visitor's identity exactly as before.
   *
   * Throws {@link ServerApiUnreachableError} when the API could not be reached at all. That is the
   * whole point: a transport blip used to return the same `null` as "no such page", and the route
   * then answered a hard 404 for a page that exists — telling crawlers to delist it. An
   * unreachable API must surface as a 5xx, which is honest and retryable.
   */
  private static readonly resolveFetchCache = RequestScope.memo(async (queryString: string): Promise<Record<string, any> | null> => {
    const path = ServerApiPaths.buildSystemResolvePath(queryString);
    // A preview navigation is the operator asking to see their own draft, so this one fetch also
    // presents their admin session — the API decides from that identity whether unpublished content
    // is readable. The `preview=1` in this query string is the FRONTEND's own marker (it drives the
    // decision below and keeps this memo key distinct); the API deliberately ignores it, and must
    // keep ignoring it — reading it back there is the exact hole that let anyone read drafts.
    const forwardOperatorSession = new URLSearchParams(queryString).get('preview') === '1';
    const response = (await ServerApiUtils.serverFetchResponseOutcome(path, undefined, { forwardOperatorSession }))
      .valueOrThrow(path);
    if (!response || !response.ok) return null;
    return await response.json() as Record<string, any>;
  });

  static async readSettingValue(key: string): Promise<string> {
    return FrontendPublicSettings.readSettingValue(key);
  }

  static async getLocaleRoutingConfig(): Promise<{ strategy: LocaleUrlStrategy; enabledLocales: Set<string> }> {
    const [strategyValue, enabledLocalesValue, localizationLocalesValue] = await Promise.all([
      DynamicPageResolver.readSettingValue('locale_url_strategy'),
      DynamicPageResolver.readSettingValue('enabled_locales'),
      DynamicPageResolver.readSettingValue('localization_locales'),
    ]);

    const strategy: LocaleUrlStrategy = LocaleUrlStrategy.resolve(strategyValue);

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
    searchParams: Record<string, string | string[] | undefined> | undefined,
    pathLocale: string | undefined,
    strategy: LocaleUrlStrategy,
  ): Promise<string> {
    return FrontendLocaleService.resolveLocale(searchParams, pathLocale, strategy);
  }

  static async resolveDoc(
    slug: string,
    searchParams: Record<string, string | string[] | undefined> | undefined,
    localeOverride: string | undefined,
    strategy: LocaleUrlStrategy,
  ): Promise<any | null> {
    const result = await DynamicPageResolver.resolveDocResult(slug, searchParams, localeOverride, strategy);
    return result?.doc || null;
  }

  static async resolveDocResult(
    slug: string,
    searchParams: Record<string, string | string[] | undefined> | undefined,
    localeOverride: string | undefined,
    strategy: LocaleUrlStrategy,
    reportMiss = false,
  ): Promise<IResolvedDocResult | null> {
    const query = new URLSearchParams();
    query.set('slug', slug);
    const locale = await DynamicPageResolver.resolveLocale(searchParams, localeOverride, strategy);
    const fallbackLocale = LocalizationUtils.normalizeLocaleCode(QueryParamUtils.readSearchValue(searchParams, 'fallback_locale'));
    if (locale) query.set('locale', locale);
    if (fallbackLocale) query.set('fallback_locale', fallbackLocale);
    if (QueryParamUtils.isPreviewMode(searchParams)) query.set('preview', '1');
    // Preview navigations present the operator's session, which only `resolveFetchCache` forwards.
    const missReported = reportMiss && !QueryParamUtils.isPreviewMode(searchParams);
    if (missReported) query.set('missed', '1');

    const result = missReported
      ? await MissedResolutionFetch.fetch(query.toString())
      : await DynamicPageResolver.resolveFetchCache(query.toString());
    if (!result) return missReported ? { type: '', plugin: '', doc: null, canonicalPath: '', redirect: null, missReported } : null;

    return {
      type: String(result?.type || '').trim(),
      plugin: String(result?.plugin || '').trim(),
      doc: ResolvedContentShape.normalize((result?.doc as Record<string, unknown> | null) || null),
      canonicalPath: String(result?.canonicalPath || '').trim(),
      redirect: StorefrontMissRedirect.of(result),
      missReported,
    };
  }

  /** See StorefrontMissRedirect.afterMiss. */
  static async redirectAfterMiss(slug: string, resolution: IResolvedDocResult | null): Promise<IStorefrontRedirectRule | null> {
    return StorefrontMissRedirect.afterMiss(slug, resolution);
  }

  /** See StorefrontMissRedirect.lookup. */
  static async resolveRedirect(slug: string): Promise<IStorefrontRedirectRule | null> {
    return StorefrontMissRedirect.lookup(slug);
  }

  static async resolveDocWithPermalinkFallback(
    slug: string,
    searchParams: Record<string, string | string[] | undefined> | undefined,
    localeOverride: string | undefined,
    strategy: LocaleUrlStrategy,
  ): Promise<any | null> {
    const result = await DynamicPageResolver.resolveDocWithPermalinkFallbackResult(slug, searchParams, localeOverride, strategy);
    return result?.doc || null;
  }

  /**
   * `reportMiss`: this lookup is the request's last word on the path, so the API may report a miss from
   * it. An account section still has the account base to try, so its first lookup never reports.
   * (The API normalizes `slug` and `/slug` to the same path, so one lookup covers both spellings.)
   */
  static async resolveDocWithPermalinkFallbackResult(
    slug: string,
    searchParams: Record<string, string | string[] | undefined> | undefined,
    localeOverride: string | undefined,
    strategy: LocaleUrlStrategy,
    reportMiss = false,
  ): Promise<IResolvedDocResult | null> {
    const cleanSlug = String(slug || '').trim().replace(/^\/+/, '');
    if (!cleanSlug) return null;

    const isAccountSection = DynamicPageResolver.isAccountSection(cleanSlug);
    const doc = await DynamicPageResolver.resolveDocResult(cleanSlug, searchParams, localeOverride, strategy, reportMiss && !isAccountSection);
    if (doc?.doc || !isAccountSection) return doc;

    return DynamicPageResolver.resolveAccountSection(cleanSlug, searchParams, localeOverride, strategy);
  }

  private static isAccountSection(cleanSlug: string): boolean {
    const base = AccountRouteUtils.base().replace(/^\/+|\/+$/g, '');
    return Boolean(base) && cleanSlug.startsWith(`${base}/`);
  }

  /**
   * An account SECTION (`/account/orders`, `/account/profile`, …) is the account page: its shell picks
   * the section from the URL. Only the base page exists as content, so a section opened directly — a
   * bookmark, a refresh, a link in an email — resolved nothing and answered 404, while the same page
   * reached by clicking inside the account worked. The base page answers for every section, and it
   * keeps no canonical path: redirecting to it would drop the section the visitor asked for.
   */
  private static async resolveAccountSection(
    cleanSlug: string,
    searchParams: Record<string, string | string[] | undefined> | undefined,
    localeOverride: string | undefined,
    strategy: LocaleUrlStrategy,
  ): Promise<IResolvedDocResult | null> {
    const base = AccountRouteUtils.base().replace(/^\/+|\/+$/g, '');
    if (!base || !cleanSlug.startsWith(`${base}/`)) return null;
    const account = await DynamicPageResolver.resolveDocResult(base, searchParams, localeOverride, strategy);
    return account?.doc ? { ...account, canonicalPath: '' } : account;
  }

  static async resolveBySlug(
    slug: string,
    locale: string,
    fallbackLocale: string,
    searchParams?: Record<string, string | string[] | undefined>,
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
    searchParams?: Record<string, string | string[] | undefined>,
  ): Promise<IResolvedDocResult | null> {
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
      canonicalPath: String(result?.canonicalPath || '').trim(),
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

  static async resolveHomeTarget(
    locale: string,
    fallbackLocale: string,
    searchParams?: Record<string, string | string[] | undefined>,
  ): Promise<{ content: any | null; forcedLayout: string | null; resolution: IResolvedDocResult | null }> {
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
        const result = await ServerApiUtils.serverFetchJson(ServerApiPaths.buildCollectionLookupPath(collectionSlug, { id: recordId, limit: 1 }));
        const doc = ServerApiUtils.extractFirstDoc(result);
        if (doc) {
          const normalized = ResolvedContentShape.normalize(doc as Record<string, unknown>);
          // An operator pinned this record to the home route, so home IS where it belongs — declaring
          // any other canonical path here would bounce every visitor straight off the front page.
          return { content: normalized, forcedLayout: null, resolution: { type: '', plugin: '', doc: normalized, canonicalPath: '' } };
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

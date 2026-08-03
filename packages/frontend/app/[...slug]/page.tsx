import { connection } from 'next/server';
import { LocaleUrlStrategy } from '@fromcode119/core/client';
import { LocalizationUtils } from '@fromcode119/core/client';
import { notFound, redirect, permanentRedirect } from 'next/navigation';
import { DynamicContentClient } from '@/app/components/view/dynamic-content-client.client';
import { PageDocPrefetchView } from '@/components/page-doc-prefetch';
import { ThemeSsrHeadView } from '@/components/theme-ssr-head';
import { FrontendLocaleService } from '@/lib/frontend-locale-service';
import { ThemeServerRenderer } from '@/lib/ssr/theme-server-renderer';
import { RouteSegmentUtils } from '@/lib/route-segment-utils';
import { QueryParamUtils } from '@/lib/query-param-utils';
import { DynamicPageResolver } from '@/lib/dynamic-page-resolver';
import { ResolvedContentMetadata } from '@/lib/resolved-content-metadata';

export class DynamicContentPageRoute {
  /**
   * One resolved document → the page tree. Shared by the home-target and slug branches so both get
   * the server-rendered theme chrome; without it the two would drift.
   */
  private static async renderResolvedContent(content: unknown, strategy: LocaleUrlStrategy) {
    const locale = await FrontendLocaleService.resolveDocumentLocale(strategy);
    // Mirrors DynamicContentClient's own content wrapper, so the box the server paints is the box
    // the client fills in.
    const ssrMarkup = await ThemeServerRenderer.render({
      content,
      locale,
      contentClassName: 'w-full',
      contentStyle: { minHeight: '100svh' },
    });
    return (
      <>
        {/* Emotion styles + LCP image preload, hoisted into <head> by React. */}
        {ssrMarkup ? <ThemeSsrHeadView.render markup={ssrMarkup} /> : null}
        {/* Page-scoped data prefetch (theme.json `fromPage` entries) — body script, pre-theme-boot. */}
        <PageDocPrefetchView.render content={content} />
        <DynamicContentClient content={content} ssrHtml={ssrMarkup?.bodyHtml || ''} ssrRendersContentSlot={Boolean(ssrMarkup?.rendersContentSlot)} />
      </>
    );
  }

  static async generateMetadata({ params, searchParams }: {
    params: ({ slug?: string[] } | Promise<{ slug?: string[] }>);
    searchParams?: (Record<string, string | string[] | undefined> | Promise<Record<string, string | string[] | undefined>>);
  }) {

    // Opt into dynamic rendering without a route-segment `export const`.
    await connection();
    const resolvedParams = await params;
    const resolvedSearchParams = await QueryParamUtils.resolveSearchParams(searchParams);
    const slugArray = Array.isArray(resolvedParams?.slug) ? resolvedParams.slug : [];
    if (RouteSegmentUtils.shouldBypassDynamicRouting(slugArray)) {
      return {};
    }
    const routingConfig = await DynamicPageResolver.getLocaleRoutingConfig();
    let pathLocale = '';
    let normalizedSegments = slugArray.map((part) => String(part || '').trim()).filter(Boolean);
    if (routingConfig.strategy === LocaleUrlStrategy.PATH && normalizedSegments.length) {
      const firstSegmentLocale = LocalizationUtils.normalizeLocaleCode(normalizedSegments[0]);
      if (routingConfig.enabledLocales.has(firstSegmentLocale)) {
        pathLocale = firstSegmentLocale;
        normalizedSegments = normalizedSegments.slice(1);
      }
    }
    if (RouteSegmentUtils.shouldBypassDynamicRouting(normalizedSegments)) {
      return {};
    }
    const slug = normalizedSegments.join('/').trim();
    const locale = await DynamicPageResolver.resolveLocale(resolvedSearchParams, pathLocale, routingConfig.strategy);
    const fallbackLocale = LocalizationUtils.normalizeLocaleCode(QueryParamUtils.readSearchValue(resolvedSearchParams, 'fallback_locale'));
    if (!slug) {
      const { content, resolution } = await DynamicPageResolver.resolveHomeTarget(locale, fallbackLocale, resolvedSearchParams);
      return ResolvedContentMetadata.buildEnriched((content as Record<string, unknown> | null) || null, resolution?.type, '/');
    }
    const resolution = await DynamicPageResolver.resolveDocWithPermalinkFallbackResult(
      slug,
      resolvedSearchParams,
      locale,
      routingConfig.strategy,
    );
    return ResolvedContentMetadata.buildEnriched(resolution?.doc || null, resolution?.type, `/${slug}`);
  }

  static async render({ params, searchParams }: {
    params: ({ slug?: string[] } | Promise<{ slug?: string[] }>);
    searchParams?: (Record<string, string | string[] | undefined> | Promise<Record<string, string | string[] | undefined>>);
  }) {

    const resolvedParams = await params;
    const resolvedSearchParams = await QueryParamUtils.resolveSearchParams(searchParams);
    const slugArray = Array.isArray(resolvedParams?.slug) ? resolvedParams.slug : [];
    if (RouteSegmentUtils.shouldBypassDynamicRouting(slugArray)) {
      notFound();
    }
    const routingConfig = await DynamicPageResolver.getLocaleRoutingConfig();
    let pathLocale = '';
    let normalizedSegments = slugArray.map((part) => String(part || '').trim()).filter(Boolean);
    if (routingConfig.strategy === LocaleUrlStrategy.PATH && normalizedSegments.length) {
      const firstSegmentLocale = LocalizationUtils.normalizeLocaleCode(normalizedSegments[0]);
      if (routingConfig.enabledLocales.has(firstSegmentLocale)) {
        pathLocale = firstSegmentLocale;
        normalizedSegments = normalizedSegments.slice(1);
      }
    }
    if (RouteSegmentUtils.shouldBypassDynamicRouting(normalizedSegments)) {
      notFound();
    }
    const slug = normalizedSegments.join('/').trim();
    const locale = await DynamicPageResolver.resolveLocale(resolvedSearchParams, pathLocale, routingConfig.strategy);
    const fallbackLocale = LocalizationUtils.normalizeLocaleCode(QueryParamUtils.readSearchValue(resolvedSearchParams, 'fallback_locale'));
    if (!slug) {
      const { content } = await DynamicPageResolver.resolveHomeTarget(locale, fallbackLocale, resolvedSearchParams);
      if (!content) notFound();
      return DynamicContentPageRoute.renderResolvedContent(content, routingConfig.strategy);
    }
    const content = await DynamicPageResolver.resolveDocWithPermalinkFallback(slug, resolvedSearchParams, locale, routingConfig.strategy);
    if (content) {
      return DynamicContentPageRoute.renderResolvedContent(content, routingConfig.strategy);
    }
    // Nothing resolved at this path — honour a configured SEO redirect (retired URL) before 404ing.
    const redirectRule = await DynamicPageResolver.resolveRedirect(slug);
    if (redirectRule) {
      if (redirectRule.permanent) permanentRedirect(redirectRule.target);
      redirect(redirectRule.target);
    }
    notFound();
  }
}

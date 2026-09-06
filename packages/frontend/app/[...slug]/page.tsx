import { connection } from 'next/server';
import { LocaleUrlStrategy } from '@fromcode119/core/client';
import { LocalizationUtils } from '@fromcode119/core/client';
import { notFound, redirect, permanentRedirect } from 'next/navigation';
import { DynamicContentClient } from '@/app/components/view/dynamic-content-client.client';
import { PageDocPrefetchView } from '@/components/page-doc-prefetch';
import { ThemeSsrHeadView } from '@/components/theme-ssr-head';
import { FrontendLocaleService } from '@/lib/frontend-locale-service';
import { ThemeServerRenderer } from '@/lib/ssr/theme-server-renderer';
import { StorefrontPageKind } from '@/runtime/storefront-page-kind';
import { RouteSegmentUtils } from '@/lib/route-segment-utils';
import { QueryParamUtils } from '@/lib/query-param-utils';
import { DynamicPageResolver } from '@/lib/dynamic-page-resolver';
import { CanonicalPathRedirect } from '@/lib/canonical-path-redirect';
import { ResolvedContentMetadata } from '@/lib/resolved-content-metadata';
import { StructuredDataScriptsView } from '@/components/structured-data-scripts';
import { AccountRouteGuard } from '@/lib/account-route-guard';

export class DynamicContentPageRoute {
  /**
   * One resolved document → the page tree. Shared by the home-target and slug branches so both get
   * the server-rendered theme chrome; without it the two would drift.
   */
  private static async renderResolvedContent(content: unknown, strategy: LocaleUrlStrategy, resolutionType: string | undefined, url: string) {
    const locale = await FrontendLocaleService.resolveDocumentLocale(strategy);
    // Same head-data query generateMetadata built, so the per-request cache serves both from one fetch.
    const schema = await ResolvedContentMetadata.buildStructuredData((content as Record<string, unknown> | null) || null, resolutionType, url);
    // `StorefrontPageKind.CONTENT` mirrors DynamicContentClient's own content wrapper, so the box the
    // server paints is the box the client fills in — and the box the runtime's client twin hydrates.
    const ssrMarkup = await ThemeServerRenderer.render({
      content,
      locale,
      contentClassName: StorefrontPageKind.CONTENT.contentClassName,
      contentStyle: StorefrontPageKind.CONTENT.contentStyle,
    });
    return (
      <>
        {/* Emotion styles + LCP image preload, hoisted into <head> by React. */}
        {ssrMarkup ? <ThemeSsrHeadView.render markup={ssrMarkup} /> : null}
        {/* JSON-LD structured data — body-rendered; Next's Metadata API cannot carry it. */}
        <StructuredDataScriptsView.render schema={schema} />
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
    // Before ANY content resolves: the account is private, and it is client-rendered, so without this
    // a guest received the whole shell and every section name and was only bounced once a client
    // component had mounted and asked. Matched on the locale-stripped path, returned to the path the
    // visitor actually typed. A no-op everywhere outside `/account`.
    await AccountRouteGuard.enforce(`/${slug}`, `/${slugArray.join('/')}`);
    const locale = await DynamicPageResolver.resolveLocale(resolvedSearchParams, pathLocale, routingConfig.strategy);
    const fallbackLocale = LocalizationUtils.normalizeLocaleCode(QueryParamUtils.readSearchValue(resolvedSearchParams, 'fallback_locale'));
    if (!slug) {
      const { content, resolution } = await DynamicPageResolver.resolveHomeTarget(locale, fallbackLocale, resolvedSearchParams);
      if (!content) notFound();
      return DynamicContentPageRoute.renderResolvedContent(content, routingConfig.strategy, resolution?.type, '/');
    }
    const resolution = await DynamicPageResolver.resolveDocWithPermalinkFallbackResult(slug, resolvedSearchParams, locale, routingConfig.strategy);
    if (resolution?.doc) {
      // The document resolved — but a document has ONE home, and several routes can match the same
      // one (a product's own permalink and the generic `/shop/:slug` detail route both find it). Send
      // the visitor to the path its owning plugin declares BEFORE rendering: painting the page here
      // would publish the same document twice, each copy claiming to be the original.
      const canonicalTarget = CanonicalPathRedirect.resolveTarget({
        canonicalPath: resolution.canonicalPath,
        requestSlug: slug,
        pathLocale,
        strategy: routingConfig.strategy,
        searchParams: resolvedSearchParams,
      });
      if (canonicalTarget) permanentRedirect(canonicalTarget);
      return DynamicContentPageRoute.renderResolvedContent(resolution.doc, routingConfig.strategy, resolution.type, `/${slug}`);
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

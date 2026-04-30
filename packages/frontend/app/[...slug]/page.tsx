import { LocalizationUtils } from '@fromcode119/core/client';
import { notFound } from 'next/navigation';
import DynamicContentClient from '../dynamic-content-client';
import { RouteSegmentUtils } from '@/lib/route-segment-utils';
import { QueryParamUtils } from '@/lib/query-param-utils';
import { DynamicPageResolver } from '@/lib/dynamic-page-resolver';
import { ResolvedContentMetadata } from '@/lib/resolved-content-metadata';
import { LcpPreloader } from '@/lib/lcp-preloader';
import type { SearchParams, MaybePromise } from '@/lib/dynamic-page-resolver.types';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: MaybePromise<{ slug?: string[] }>;
  searchParams?: MaybePromise<SearchParams>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = await QueryParamUtils.resolveSearchParams(searchParams);
  const slugArray = Array.isArray(resolvedParams?.slug) ? resolvedParams.slug : [];

  if (RouteSegmentUtils.shouldBypassDynamicRouting(slugArray)) {
    return {};
  }

  const routingConfig = await DynamicPageResolver.getLocaleRoutingConfig();

  let pathLocale = '';
  let normalizedSegments = slugArray.map((part) => String(part || '').trim()).filter(Boolean);
  if (routingConfig.strategy === 'path' && normalizedSegments.length) {
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
    return ResolvedContentMetadata.build((content as Record<string, unknown> | null) || null, resolution?.type);
  }

  const resolution = await DynamicPageResolver.resolveDocWithPermalinkFallbackResult(
    slug,
    resolvedSearchParams,
    locale,
    routingConfig.strategy,
  );

  return ResolvedContentMetadata.build(resolution?.doc || null, resolution?.type);
}

export default async function DynamicContentPage({
  params,
  searchParams,
}: {
  params: MaybePromise<{ slug?: string[] }>;
  searchParams?: MaybePromise<SearchParams>;
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
  if (routingConfig.strategy === 'path' && normalizedSegments.length) {
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
    const lcpImageUrl = await LcpPreloader.preloadForContent(content as Record<string, unknown>);
    return (
      <>
        {lcpImageUrl ? <link rel="preload" as="image" href={lcpImageUrl} fetchPriority="high" /> : null}
        <DynamicContentClient content={content} lcpImageUrl={lcpImageUrl} />
      </>
    );
  }

  const content = await DynamicPageResolver.resolveDocWithPermalinkFallback(slug, resolvedSearchParams, locale, routingConfig.strategy);
  if (content) {
    const lcpImageUrl = await LcpPreloader.preloadForContent(content as Record<string, unknown>);
    return (
      <>
        {lcpImageUrl ? <link rel="preload" as="image" href={lcpImageUrl} fetchPriority="high" /> : null}
        <DynamicContentClient content={content} lcpImageUrl={lcpImageUrl} />
      </>
    );
  }

  notFound();
}

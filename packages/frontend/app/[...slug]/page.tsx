import { LocalizationUtils } from '@fromcode119/core/client';
import { notFound } from 'next/navigation';
import DynamicContentClient from '../dynamic-content-client';
import { RouteSegmentUtils } from '@/lib/route-segment-utils';
import { QueryParamUtils } from '@/lib/query-param-utils';
import { DynamicPageResolver } from '@/lib/dynamic-page-resolver';
import type { SearchParams, MaybePromise } from '@/lib/dynamic-page-resolver.types';

export const dynamic = 'force-dynamic';

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
    return <DynamicContentClient content={content} />;
  }

  const content = await DynamicPageResolver.resolveDocWithPermalinkFallback(slug, resolvedSearchParams, locale, routingConfig.strategy);
  if (content) {
    return <DynamicContentClient content={content} />;
  }

  notFound();
}

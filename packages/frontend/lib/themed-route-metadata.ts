import type { Metadata } from 'next';
import { DynamicPageResolver } from '@/lib/dynamic-page-resolver';
import { QueryParamUtils } from '@/lib/query-param-utils';
import { ResolvedContentMetadata } from '@/lib/resolved-content-metadata';

/**
 * The head of a native route that renders a theme's content page — `/unsubscribe`, `/register`,
 * `/forgot-password`, `/reset-password`.
 *
 * Those routes resolve the themed page and hand it to `DynamicContentClient`, so the BODY is the page the
 * operator edited. The head used to be left to the root layout, so the tab read only the site name and
 * the page had no canonical link, whatever title and SEO fields the operator gave it. This builds the
 * head from the same page, the way the catch-all route does for every other content page.
 *
 * No themed page (or any failure resolving one) means no page-level head: the root layout's site-wide
 * defaults stand, exactly as before.
 */
export class ThemedRouteMetadata {
  static async build(
    slug: string,
    searchParams?: (Record<string, string | string[] | undefined> | Promise<Record<string, string | string[] | undefined>>),
  ): Promise<Metadata> {
    try {
      const resolvedSearchParams = await QueryParamUtils.resolveSearchParams(searchParams);
      const routingConfig = await DynamicPageResolver.getLocaleRoutingConfig();
      const locale = await DynamicPageResolver.resolveLocale(resolvedSearchParams, '', routingConfig.strategy);
      const resolution = await DynamicPageResolver.resolveDocWithPermalinkFallbackResult(
        slug,
        resolvedSearchParams,
        locale,
        routingConfig.strategy,
      );
      if (!resolution?.doc) return {};
      return ResolvedContentMetadata.buildEnriched(resolution.doc as Record<string, unknown>, resolution.type, `/${slug}`);
    } catch {
      return {};
    }
  }
}

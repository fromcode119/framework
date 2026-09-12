import { SiteVisibilityVerdict } from '@/lib/document/site-visibility-verdict';
import { NextResponse } from 'next/server';
import { ServerApiPaths } from '@/lib/server-api/server-api-paths';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { LocaleUrlStrategy, LocalizationUtils } from '@fromcode119/core/client';
import { HomePageResolver } from '@/app/home-page-resolver';
import { AccountRouteGuard } from '@/lib/account-route-guard';
import { CanonicalPathRedirect } from '@/lib/canonical-path-redirect';
import { DocumentCompression } from '@/lib/document/document-compression';
import { DocumentMarkupRenderer } from '@/lib/document/document-markup-renderer';
import { DocumentView } from '@/lib/document/document-view';
import { FrontendLayoutStylesheets } from '@/lib/document/frontend-layout-stylesheets';
import { FrontendRuntimeAssetManifest } from '@/lib/document/frontend-runtime-asset-manifest';
import { PluginBundlePolicy } from '@/lib/document/plugin-bundle-policy';
import { StorefrontDocumentRequest } from '@/lib/document/storefront-document-request';
import { ThemeHeadModel } from '@/lib/document/theme-head-model';
import { DynamicPageResolver } from '@/lib/dynamic-page-resolver';
import { FrontendConfigCache } from '@/lib/frontend-config-cache';
import { FrontendLocaleService } from '@/lib/frontend-locale-service';
import { FrontendTranslationsCache } from '@/lib/frontend-translations-cache';
import { PluginInjectionRenderer } from '@/lib/plugin-injection-renderer';
import { ResolvedContentMetadata } from '@/lib/resolved-content-metadata';
import { RouteSegmentUtils } from '@/lib/route-segment-utils';
import { ServerApiUtils } from '@/lib/server-api/server-api';
import { PageDocPrefetchRequestCache } from '@/lib/theme/page-doc-prefetch-request-cache';
import { ThemeServerRenderer } from '@/lib/ssr/theme-server-renderer';
import { StorefrontPageKind } from '@/runtime/storefront-page-kind';

/**
 * The islands document for `/` and every content path: the SAME resolution the App Router pages run
 * (locale prefix, account gate, home target, permalink fallback, canonical redirect, SEO redirect,
 * 404) — shared here instead of duplicated between `app/page.tsx` and `app/[...slug]/page.tsx` — then
 * one static HTML response: server-rendered theme + one deferred runtime script. No Next client
 * runtime, no flight payload.
 *
 * `redirect()`/`permanentRedirect()`/`notFound()` are Next's own signals and work in route handlers
 * exactly as in pages; nothing here catches them.
 */
export class StorefrontDocumentRenderer {
  static async render(request: StorefrontDocumentRequest): Promise<Response> {
    // FIRST, before any routing or content lookup. The api refuses a private site's content with a
    // 503 and the storefront turns that into a 500, so asking later means the visitor sees an error
    // page instead of a holding page — which is what happened when this check lived further down.
    if (!(await SiteVisibilityVerdict.isReadable())) return StorefrontDocumentRenderer.holding();

    if (RouteSegmentUtils.shouldBypassDynamicRouting(request.segments)) notFound();
    const routingConfig = await DynamicPageResolver.getLocaleRoutingConfig();
    const { pathLocale, segments } = StorefrontDocumentRenderer.stripPathLocale(request.segments, routingConfig.strategy, routingConfig.enabledLocales);
    if (RouteSegmentUtils.shouldBypassDynamicRouting(segments)) notFound();
    const slug = segments.join('/').trim();
    await AccountRouteGuard.enforce(`/${slug}`, request.pathname);

    if (!slug) {
      const home = await HomePageResolver.resolve(request.searchParams);
      if (!home.content && !home.forcedLayout) return StorefrontDocumentRenderer.notFoundDocument(request, routingConfig.strategy);
      return StorefrontDocumentRenderer.document({
        content: home.content, resolutionType: home.resolution?.type, url: '/', layoutName: home.forcedLayout || '',
        pageKind: StorefrontPageKind.HOME, strategy: routingConfig.strategy, acceptEncoding: request.acceptEncoding,
      });
    }

    const locale = await DynamicPageResolver.resolveLocale(request.searchParams, pathLocale, routingConfig.strategy);
    const resolution = await DynamicPageResolver.resolveDocWithPermalinkFallbackResult(slug, request.searchParams, locale, routingConfig.strategy);
    if (resolution?.doc) {
      const canonicalTarget = CanonicalPathRedirect.resolveTarget({
        canonicalPath: resolution.canonicalPath, requestSlug: slug, pathLocale, strategy: routingConfig.strategy, searchParams: request.searchParams,
      });
      if (canonicalTarget) permanentRedirect(canonicalTarget);
      return StorefrontDocumentRenderer.document({
        content: resolution.doc, resolutionType: resolution.type, url: `/${slug}`, layoutName: '',
        pageKind: StorefrontPageKind.CONTENT, strategy: routingConfig.strategy, acceptEncoding: request.acceptEncoding,
      });
    }
    const redirectRule = await DynamicPageResolver.resolveRedirect(slug);
    if (redirectRule) {
      if (redirectRule.permanent) permanentRedirect(redirectRule.target);
      redirect(redirectRule.target);
    }
    return StorefrontDocumentRenderer.notFoundDocument(request, routingConfig.strategy);
  }

  /**
   * Nothing resolved: the theme layout around the framework's 404 body (a theme's `frontend.page.404`
   * override wins), status 404, `noindex` — what the App Router's `not-found` renders, as a document
   * the runtime can hydrate. A route handler's `notFound()` would answer with an EMPTY 404 instead.
   */
  private static notFoundDocument(request: StorefrontDocumentRequest, strategy: LocaleUrlStrategy): Promise<Response> {
    return StorefrontDocumentRenderer.document({
      content: null, resolutionType: undefined, url: request.pathname, layoutName: '', pageKind: StorefrontPageKind.NOT_FOUND,
      strategy, status: 404, notFoundPath: request.pathname, acceptEncoding: request.acceptEncoding,
    });
  }

  private static stripPathLocale(raw: string[], strategy: LocaleUrlStrategy, enabledLocales: Set<string>): { pathLocale: string; segments: string[] } {
    const segments = raw.map((part) => String(part || '').trim()).filter(Boolean);
    if (strategy !== LocaleUrlStrategy.PATH || !segments.length) return { pathLocale: '', segments };
    const first = LocalizationUtils.normalizeLocaleCode(segments[0]);
    return enabledLocales.has(first) ? { pathLocale: first, segments: segments.slice(1) } : { pathLocale: '', segments };
  }

  /**
   * What an unpublished site says to a visitor.
   *
   * 503 rather than 404: the site exists and will be there later, and a 404 tells a crawler the
   * address is wrong.
   *
   * KNOWN LIMIT: the payload this decision reads is fetched server-to-server without the visitor's
   * cookies, so the storefront knows the site is private but not who is asking — an admin previewing
   * sees this too. The api-side gate already admits admins; wiring the same for SSR needs the
   * session forwarded on that fetch. Until then, previewing means publishing as `unlisted` first. `no-store` because the answer changes the moment somebody publishes, and
   * `X-Robots-Tag` because a holding page must never be the thing that gets indexed.
   */
  private static holding(): Response {
    const body = '<!doctype html><html lang="en"><head><meta charset="utf-8">'
      + '<meta name="viewport" content="width=device-width, initial-scale=1">'
      + '<meta name="robots" content="noindex, nofollow">'
      + '<title>Not published yet</title></head>'
      + '<body style="margin:0;display:grid;place-items:center;min-height:100vh;'
      + 'font:16px/1.5 system-ui,sans-serif;color:#334155;background:#f8fafc">'
      + '<main><p>This site is not published yet.</p></main></body></html>';

    return new Response(body, {
      status: 503,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Retry-After': '3600',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  }

  private static async document(args: {
    content: unknown; resolutionType: string | undefined; url: string; layoutName: string; pageKind: StorefrontPageKind; strategy: LocaleUrlStrategy;
    status?: number; notFoundPath?: string; acceptEncoding?: string;
  }): Promise<Response> {
    const content = (args.content as Record<string, unknown> | null) || null;
    const locale = await FrontendLocaleService.resolveDocumentLocale(args.strategy);
    const [page, site, schema, markup, theme, headInjections, bodyStartInjections, frontend, translations, pageDocPrefetch] = await Promise.all([
      // The robots directive is the FRAMEWORK's last word, applied after whichever plugin built the
      // head. A 404 is never indexable, and neither is a site that has not been published — that is
      // a fact about the site, not about its content, so no plugin gets to contradict it and it
      // holds even when the plugin that would normally set robots is inactive.
      ResolvedContentMetadata.buildEnriched(content, args.resolutionType, args.url)
        .then(async (page) => (args.status === 404 || !(await SiteVisibilityVerdict.indexableOrUntenanted())
          ? { ...page, robots: { index: false, follow: false } }
          : page)),
      ResolvedContentMetadata.buildSiteMetadata(),
      ResolvedContentMetadata.buildStructuredData(content, args.resolutionType, args.url),
      ThemeServerRenderer.render({ content: args.content, locale, contentClassName: args.pageKind.contentClassName, contentStyle: args.pageKind.contentStyle, notFoundPath: args.notFoundPath }),
      ThemeHeadModel.load(),
      PluginInjectionRenderer.loadHeadElements(),
      PluginInjectionRenderer.loadBodyStartElements(),
      FrontendConfigCache.read(),
      FrontendTranslationsCache.read(locale),
      PageDocPrefetchRequestCache.read(args.content),
    ]);
    const activeTheme = (frontend?.activeTheme as Record<string, any> | null) || null;
    const skipPlugins = PluginBundlePolicy.skippable({
      plugins: Array.isArray(frontend?.plugins) ? (frontend!.plugins as any[]) : [],
      usedPlugins: markup?.usedPlugins ?? [],
      withServerBundle: ThemeServerRenderer.pluginsWithServerBundle(),
      themeDependencies: Object.keys((activeTheme?.dependencies as Record<string, unknown> | undefined) || {}),
    });
    const runtimeConfig = {
      apiUrl: ServerApiPaths.buildPublicApiBaseUrl(),
      skipPlugins,
      locale,
      content,
      layoutName: args.layoutName,
      ssrRendersContentSlot: Boolean(markup?.rendersContentSlot),
      pageKind: args.pageKind.value,
      notFoundPath: args.notFoundPath || '',
      frontend: frontend || {},
      translations,
    };
    const html = DocumentMarkupRenderer.render(DocumentView.render, {
      lang: locale, page, site, theme, markup, headInjections, bodyStartInjections, schema, pageDocPrefetch, runtimeConfig,
      runtimeScriptPath: FrontendRuntimeAssetManifest.runtimeScriptPath(),
      layoutStylesheets: FrontendLayoutStylesheets.hrefs(),
      status: args.status || 200,
    });
    const encoded = DocumentCompression.encode(`<!DOCTYPE html>${html}`, args.acceptEncoding);
    return new NextResponse(encoded.body as unknown as BodyInit, { status: args.status || 200, headers: DocumentCompression.headers(encoded.encoding) });
  }
}

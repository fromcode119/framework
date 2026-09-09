import { ApiPathUtils, PublicAssetUrlUtils, RuntimeConstants } from '@fromcode119/core/client';
import { ServerApiPaths } from '@/lib/server-api/server-api-paths';
import { FrontendAssetVersionUrlService } from '@/lib/frontend-asset-version-url-service';
import { FrontendConfigCache } from '@/lib/frontend-config-cache';
import { ServerApiUtils } from '@/lib/server-api/server-api';
import { ThemeCssUrlRewriter } from '@/lib/theme/theme-css-url-rewriter';
import { ThemeDataPrefetcher } from '@/lib/theme/theme-data-prefetcher';
import { ThemePrefetchRequestCache } from '@/lib/theme/theme-prefetch-request-cache';
import type { ILcpImagePreload } from '@/lib/theme/interfaces/lcp-image-preload.interface';
import { ThemeHeadLink } from '@/lib/document/theme-head-link';

/**
 * Everything the active theme contributes to `<head>`, resolved once per request and rendered by two
 * consumers: `ThemeAssetsView` (the App Router layout, which also issues React's `preconnect()`/
 * `preload()` hints) and `DocumentHeadView` (the islands document, which emits the same hints as plain
 * `<link>` elements). The data is computed here so the two heads cannot drift.
 */
export class ThemeHeadModel {
  private constructor(
    readonly slug: string,
    readonly apiUrl: string,
    readonly cssVariables: string,
    readonly inlinedCss: string,
    readonly fallbackCssHrefs: string[],
    readonly headLinks: ThemeHeadLink[],
    readonly externalStylesheets: string[],
    readonly versionedEntryUrl: string,
    readonly modulePreloadUrls: string[],
    readonly prefetchScript: string,
    readonly lcpPreload: ILcpImagePreload | null,
  ) {}

  /** Head links declared as `preload` (issued as hints, not elements, by the App Router head). */
  get preloadLinks(): ThemeHeadLink[] {
    return this.headLinks.filter((link) => link.isPreload);
  }

  /** Head links rendered as `<link>` elements: everything but preloads and external stylesheets. */
  get elementLinks(): ThemeHeadLink[] {
    return this.headLinks.filter((link) => !link.isPreload && !link.isExternalStylesheet);
  }

  /**
   * The inline script that appends the entry's `modulepreload` links after `load` (idle slice) and the
   * external stylesheets with the `media="print"` swap. Built here, verbatim from the App Router head,
   * so both documents run the same bytes.
   */
  get injectorScript(): string {
    if (!this.versionedEntryUrl) return '';
    const urls = JSON.stringify([this.versionedEntryUrl, ...this.modulePreloadUrls]);
    const sheets = this.externalStylesheets.map((href) =>
      `var f=document.createElement('link');f.rel='stylesheet';f.href=${JSON.stringify(href)};f.media='print';f.onload=function(){f.media='all';f.onload=null;};document.head.appendChild(f);`).join('');
    return `(function(){var u=${urls};var p=function(){for(var i=0;i<u.length;i++){var l=document.createElement('link');l.rel='modulepreload';l.href=u[i];document.head.appendChild(l);}};var d=function(){if(window.requestIdleCallback){window.requestIdleCallback(p,{timeout:1500});}else{setTimeout(p,1);}};if(document.readyState==='complete'){d();}else{addEventListener('load',d,{once:true});}${sheets}})();`;
  }

  static async load(): Promise<ThemeHeadModel | null> {
    const config = await FrontendConfigCache.read() as Record<string, any> | null;
    const theme = config?.activeTheme;
    if (!theme?.slug) return null;

    const cssVariables = typeof config?.cssVariables === 'string' ? config.cssVariables : '';
    const rawEntryUrl = String(theme.ui?.entry || '').trim();
    const absoluteEntryUrl = rawEntryUrl.startsWith('http') ? rawEntryUrl : '';
    const apiUrl = (absoluteEntryUrl ? new URL(absoluteEntryUrl).origin : '') || ServerApiPaths.buildPublicApiBaseUrl();
    const entryUrl = rawEntryUrl ? (absoluteEntryUrl || ApiPathUtils.themeUiAssetUrl(apiUrl, theme.slug, rawEntryUrl)) : '';
    // `assetVersion` is a digest of the theme's built files; `version` is a number someone edits. Prefer
    // the one that actually moves when the theme is rebuilt (see PublicAssetUrlUtils.themeAssetStamp).
    const assetStamp = PublicAssetUrlUtils.themeAssetStamp(theme);
    const versionedEntryUrl = FrontendAssetVersionUrlService.appendVersion(entryUrl, assetStamp);

    const headLinks = (Array.isArray(theme.ui?.headLinks) ? theme.ui.headLinks : [])
      .map((link: Record<string, string>) => ThemeHeadLink.from(link, apiUrl, String(theme.slug)))
      .filter((link: ThemeHeadLink | null): link is ThemeHeadLink => link !== null);
    const externalStylesheets = headLinks.filter((link: ThemeHeadLink) => link.isExternalStylesheet).map((link: ThemeHeadLink) => link.href);

    const { inlinedCss, fallbackCssHrefs } = await ThemeHeadModel.loadCss(theme, apiUrl, assetStamp);

    // Content-hashed chunks the api derived from the theme's ui/ directory — NOT `?v=`-versioned: bundle.js
    // imports them relatively and unversioned, and a modulepreload only pays off when its url is byte-identical.
    const modulePreloadUrls: string[] = (Array.isArray(theme.ui?.modulepreload) ? theme.ui.modulepreload : [])
      .map((file: string) => String(file || '').trim())
      .filter((fileName: string) => fileName && !fileName.includes('/') && !fileName.includes('\\'))
      .map((fileName: string) => ApiPathUtils.themeUiAssetUrl(apiUrl, theme.slug, fileName));

    const prefetchData = await ThemePrefetchRequestCache.read();
    const prefetchScript = Object.keys(prefetchData).length > 0
      ? `window.${RuntimeConstants.GLOBALS.PAGE_PREFETCH}=${ThemeDataPrefetcher.safeSerialize(prefetchData)};`
      : '';
    const prefetchApis = Array.isArray(theme.ui?.prefetchApis) ? theme.ui.prefetchApis : [];
    const lcpPreload = ThemeDataPrefetcher.extractLcpImageUrl(prefetchData, prefetchApis, apiUrl);

    return new ThemeHeadModel(
      String(theme.slug), apiUrl, cssVariables, inlinedCss, fallbackCssHrefs, headLinks, externalStylesheets,
      versionedEntryUrl, modulePreloadUrls, prefetchScript, lcpPreload,
    );
  }

  /**
   * Theme CSS fetched server-side and inlined (no render-blocking external stylesheet); `<link>`
   * fallbacks when the fetch fails. Relative `url()` references resolve against the stylesheet, as
   * they would when linked.
   */
  private static async loadCss(theme: Record<string, any>, apiUrl: string, assetStamp: string): Promise<{ inlinedCss: string; fallbackCssHrefs: string[] }> {
    const cssPaths: string[] = Array.isArray(theme.ui?.css) ? theme.ui.css : [];
    if (!cssPaths.length) return { inlinedCss: '', fallbackCssHrefs: [] };
    const publicHrefs = cssPaths.map((cssPath) => (cssPath.startsWith('http') ? cssPath : ApiPathUtils.themeUiAssetUrl(apiUrl, theme.slug, cssPath)));
    try {
      const internalBase = ServerApiPaths.buildInternalApiBaseUrl();
      const cssResults = await Promise.all(publicHrefs.map(async (publicHref) => {
        const versionedPublicHref = FrontendAssetVersionUrlService.appendVersion(publicHref, assetStamp);
        const response = await fetch(versionedPublicHref.replace(apiUrl, internalBase), { next: { revalidate: 3600 } });
        return response.ok ? ThemeCssUrlRewriter.rewrite(await response.text(), publicHref) : '';
      }));
      return { inlinedCss: cssResults.join('\n'), fallbackCssHrefs: [] };
    } catch {
      return { inlinedCss: '', fallbackCssHrefs: publicHrefs.map((href) => FrontendAssetVersionUrlService.appendVersion(href, assetStamp)) };
    }
  }
}

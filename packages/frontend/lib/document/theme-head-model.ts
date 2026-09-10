import { ApiPathUtils, PublicAssetUrlUtils, RuntimeConstants, ThemePackageLayout } from '@fromcode119/core/client';
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
    /** The theme's boot script, inlined — see `loadBootScript`. */
    readonly inlinedBootScript: string,
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
   * The theme entry and its chunks, as `modulepreload` hints for the HEAD.
   *
   * These used to be created by the injector script below, after the `load` event AND an idle slice
   * (`requestIdleCallback(..., {timeout: 1500})`). Measured on `/technologies/php`: `load` at 2,108 ms,
   * so the entry did not begin downloading until 2,112 ms, its chunks queued behind it, and the theme
   * did not finish mounting until about SIX SECONDS in. Everything the theme's own script does — the
   * scroll reveals, the accent word — waited that long with it.
   *
   * `modulepreload` in the head is the right tool and does not need protecting from: the browser gives
   * it a low priority by definition, so it does not compete with the LCP image or the stylesheet, and
   * it starts the download at parse time instead of a second and a half after the page finishes
   * loading. It is also NOT the `<link rel="preload" as="script">` that `ThemeAssetsView` warns about —
   * that one React 19 rewrites without `crossOrigin`, so the bundle downloads twice.
   */
  get modulePreloadLinks(): string[] {
    if (!this.versionedEntryUrl) return [];
    return [this.versionedEntryUrl, ...this.modulePreloadUrls];
  }

  /**
   * The inline script that swaps in the external stylesheets (`media="print"` then `all`). Built here,
   * verbatim from the App Router head, so both documents run the same bytes. The module preloads it
   * used to carry are now head links — see `modulePreloadLinks`.
   */
  get injectorScript(): string {
    if (!this.externalStylesheets.length) return '';
    const sheets = this.externalStylesheets.map((href) =>
      `var f=document.createElement('link');f.rel='stylesheet';f.href=${JSON.stringify(href)};f.media='print';f.onload=function(){f.media='all';f.onload=null;};document.head.appendChild(f);`).join('');
    return `(function(){${sheets}})();`;
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

    const [{ inlinedCss, fallbackCssHrefs }, inlinedBootScript] = await Promise.all([
      ThemeHeadModel.loadCss(theme, apiUrl, assetStamp),
      ThemeHeadModel.loadBootScript(theme, apiUrl, assetStamp),
    ]);

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
      String(theme.slug), apiUrl, cssVariables, inlinedCss, fallbackCssHrefs, headLinks, inlinedBootScript, externalStylesheets,
      versionedEntryUrl, modulePreloadUrls, prefetchScript, lcpPreload,
    );
  }

  /**
   * Theme CSS fetched server-side and inlined (no render-blocking external stylesheet); `<link>`
   * fallbacks when the fetch fails. Relative `url()` references resolve against the stylesheet, as
   * they would when linked.
   */
  /**
   * The theme's own boot script, fetched server-side and INLINED in the head — the same treatment
   * `ui.css` already gets, for the same reason.
   *
   * A theme's interactive chrome lives in its React bundle, and that bundle is the last thing to
   * arrive: it is imported by the storefront runtime, which runs after `load`, behind a chain of
   * module fetches. On a deployment that serves theme assets uncached — which every local one does by
   * design — that put the theme's scroll reveals about SIX SECONDS after first paint. Anything a theme
   * wants to happen AT first paint therefore cannot live in the bundle, and until now a theme had no
   * way to say so: `ui.css` could be inlined, nothing else could.
   *
   * A theme writes `ThemePackageLayout.HEAD_SCRIPT_SOURCE` (`src/boot/head.ts`) and declares NOTHING:
   * the build compiles it to `ThemePackageLayout.HEAD_SCRIPT_ARTIFACT` and this resolves that name.
   * A theme naming its own `.js` artifact was the bug — the source is `.ts`, in a different
   * directory, and the hop between them lived nowhere. See ThemePackageLayout.
   *
   * The artifact is fetched over the internal API (never from request input), inlined verbatim, and
   * runs where it sits — before the body, in milliseconds, with no bundle and no network of its own.
   * The SHIPPED file has no imports because the bundler collapsed the source into one script; that
   * is the build's guarantee, not something the theme author writes around.
   */
  private static async loadBootScript(theme: Record<string, any>, apiUrl: string, assetStamp: string): Promise<string> {
    const bootFile = ThemePackageLayout.headScriptArtifact(theme);
    if (!bootFile || bootFile.includes('/') || bootFile.includes('\\')) return '';
    try {
      const publicHref = ApiPathUtils.themeUiAssetUrl(apiUrl, theme.slug, bootFile);
      const internalBase = ServerApiPaths.buildInternalApiBaseUrl();
      const versioned = FrontendAssetVersionUrlService.appendVersion(publicHref, assetStamp);
      const response = await fetch(versioned.replace(apiUrl, internalBase), { next: { revalidate: 3600 } });
      if (!response.ok) return '';
      const source = await response.text();
      // `</script>` inside the source would close the tag it is being written into.
      return source.replace(/<\/script/gi, '<\\/script');
    } catch {
      return '';
    }
  }

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

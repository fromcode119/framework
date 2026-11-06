import { ThemeAssetTextCache } from '@/lib/document/theme-asset-text-cache';
import { ApiPathUtils, PublicAssetUrlUtils, ThemePackageLayout } from '@fromcode119/core/client';
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
    readonly prefetchData: Record<string, unknown>,
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
   * The theme entry and its chunks, warmed at PARSE time for the App Router head.
   *
   * These used to be created after the `load` event AND an idle slice; measured on `/technologies/php`
   * the theme did not finish mounting until about six seconds in. Starting the download at parse time
   * fixes that, at `fetchpriority="low"` so the 140 KB entry does not share the first round trips with
   * the fonts and the LCP image. Only the App Router layout (`ThemeAssets`) warms them: the islands
   * document boots on intent and emits none (see `DocumentHeadView`).
   *
   * NOT `modulepreload`: a module preload PARSES the file, and the bundle's bare specifiers (`react`,
   * `react/jsx-runtime`) resolve only through the runtime import map, which the runtime publishes after
   * it boots. A module parsed before the map keeps that resolution failure for the whole document, so a
   * head `modulepreload` made the theme import fail whenever the bundle arrived first ("Failed to resolve
   * module specifier"). A plain `preload as="script"` with `crossorigin` only fetches, and the later module
   * import reuses the response. It is created from a script because React 19 rewrites a rendered
   * `<link rel="preload" as="script">` without `crossOrigin`, and the bundle would then download twice.
   */
  get warmupUrls(): string[] {
    if (!this.versionedEntryUrl) return [];
    return [this.versionedEntryUrl, ...this.modulePreloadUrls];
  }

  /** The inline script that creates the {@link warmupUrls} preloads. */
  get warmupScript(): string {
    const urls = this.warmupUrls;
    if (!urls.length) return '';
    return `(function(){${ThemeHeadModel.scriptLiteral(urls)}.forEach(function(h){var l=document.createElement('link');l.rel='preload';l.as='script';l.crossOrigin='anonymous';l.setAttribute('fetchpriority','low');l.href=h;document.head.appendChild(l);});})();`;
  }

  /**
   * The inline script that swaps in the external stylesheets (`media="print"` then `all`). Built here,
   * verbatim from the App Router head, so both documents run the same bytes. The theme warm-ups
   * it used to carry are their own script — see `warmupScript`.
   */
  get injectorScript(): string {
    if (!this.externalStylesheets.length) return '';
    const sheets = this.externalStylesheets.map((href) =>
      `var f=document.createElement('link');f.rel='stylesheet';f.href=${ThemeHeadModel.scriptLiteral(href)};f.media='print';f.onload=function(){f.media='all';f.onload=null;};document.head.appendChild(f);`).join('');
    return `(function(){${sheets}})();`;
  }

  /**
   * A value as a JS literal that is safe inside an inline `<script>`: JSON alone would let a `</script>`
   * or `<!--` in a configured url end the script early, so `<`, `>`, `&` and the line separators are
   * written as unicode escapes.
   */
  private static scriptLiteral(value: unknown): string {
    return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
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
    const prefetchApis = Array.isArray(theme.ui?.prefetchApis) ? theme.ui.prefetchApis : [];
    const lcpPreload = ThemeDataPrefetcher.extractLcpImageUrl(prefetchData, prefetchApis, apiUrl);

    return new ThemeHeadModel(
      String(theme.slug), apiUrl, cssVariables, inlinedCss, fallbackCssHrefs, headLinks, inlinedBootScript, externalStylesheets,
      versionedEntryUrl, modulePreloadUrls, prefetchData, lcpPreload,
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
      const source = await ThemeAssetTextCache.read(versioned.replace(apiUrl, internalBase), Boolean(assetStamp));
      if (source === null) return '';
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
        const css = await ThemeAssetTextCache.read(versionedPublicHref.replace(apiUrl, internalBase), Boolean(assetStamp) && publicHref.startsWith(apiUrl));
        if (css === null) return '';
        return ThemeCssUrlRewriter.rewrite(css, publicHref);
      }));
      return { inlinedCss: cssResults.join('\n'), fallbackCssHrefs: [] };
    } catch {
      return { inlinedCss: '', fallbackCssHrefs: publicHrefs.map((href) => FrontendAssetVersionUrlService.appendVersion(href, assetStamp)) };
    }
  }
}

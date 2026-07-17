import { preload } from 'react-dom';
import { ClientRuntimeConstants, ApiPathUtils } from '@fromcode119/core/client';
import { FrontendConfigCache } from '@/lib/frontend-config-cache';
import { ServerApiUtils } from '@/lib/server-api';
import { ResolvedContentMetadata } from '@/lib/resolved-content-metadata';
import { ThemePrefetchRequestCache } from '@/lib/theme/theme-prefetch-request-cache';
import { SsrContentShellService } from '@/lib/ssr-shell/ssr-content-shell-service';
import { SsrShellTemplateService } from '@/lib/ssr-shell/ssr-shell-template-service';
import { SsrShellThemeTemplateLoader } from '@/lib/ssr-shell/ssr-shell-theme-template-loader';
import { SsrShellFontPreloader } from '@/lib/ssr-shell/ssr-shell-font-preloader';
import { ThemeDataPrefetcher } from '@/lib/theme/theme-data-prefetcher';
import { ResolvedContentShape } from '@/lib/resolved-content-shape';
import { PageDocPrefetchRequestCache } from '@/lib/theme/page-doc-prefetch-request-cache';
import type { ThemePrefetchApiEntry, LcpImagePreload } from '@/lib/theme/theme-data-prefetcher.interfaces';

const SHELL = ClientRuntimeConstants.FRONTEND.SSR_SHELL;

/**
 * Server Component: paints the above-the-fold shell before the client-only theme boots,
 * from data the server already fetched (the resolved page document, site settings, and
 * the theme's `ui.prefetchApis` payloads via the shared per-request caches).
 *
 * WHAT it paints is entirely theme-declared (`theme.json` → `ui.ssrShell`: a template
 * per page family + the tokens/lists it wants resolved). The framework contributes only
 * the mechanism — no content-field names live here. With no parsable config it falls
 * back to what the framework legitimately knows on its own: the site name and the
 * document title.
 *
 * Why it is hydration-safe: this renders as STATIC RSC output, a sibling placed before
 * `DynamicContentClient` in the server page. No client component ever re-renders it, so
 * server HTML and the RSC payload are identical by construction. The theme signals its
 * first real paint by setting the THEME_LIVE attribute on <html> (see `app/globals.css`),
 * which hides the shell via CSS — the DOM node itself is never removed, so React's
 * hydrated tree stays intact. If the theme never boots, the shell stays visible.
 *
 * Opt-out without rebuild: `SSR_CONTENT_SHELL=false`.
 */
export default async function SsrContentShell({ content, locale }: { content: unknown; locale?: string }) {
  if (!SsrContentShellService.isEnabled()) {
    return null;
  }

  try {
    const [config, prefetchData, pagePrefetchData, site] = await Promise.all([
      FrontendConfigCache.read() as Promise<Record<string, any> | null>,
      ThemePrefetchRequestCache.read(),
      PageDocPrefetchRequestCache.read(content),
      ResolvedContentMetadata.fetchSite(),
    ]);

    const theme = config?.activeTheme;
    const themeSlug = String(theme?.slug || '');
    const assetBaseUrl = ServerApiUtils.buildPublicApiBaseUrl();
    const shellConfig = SsrShellThemeTemplateLoader.readConfig(theme);

    const model = SsrContentShellService.build(
      { doc: content, site, prefetch: { ...prefetchData, ...pagePrefetchData } },
      shellConfig,
      { locale, assetBaseUrl, themeSlug },
    );

    // LCP image: the theme's `preload`-flagged token when it resolves; otherwise the
    // page-scoped prefetch entry's own `lcp` extraction (which also carries srcset/sizes)
    // — for documents that only reference a record by slug and hold no image themselves.
    const apis = Array.isArray(theme?.ui?.prefetchApis)
      ? (theme?.ui?.prefetchApis as ThemePrefetchApiEntry[])
      : [];
    const preloadImage: LcpImagePreload | null = model.preloadImageUrl
      ? { href: model.preloadImageUrl }
      : ThemeDataPrefetcher.extractLcpImageUrl(
          pagePrefetchData,
          apis.filter((entry) => entry.fromPage),
          assetBaseUrl,
        );

    const title = SsrContentShellService.readTitle(content, locale);
    const siteName = site?.siteName || site?.title || '';
    if (!SsrContentShellService.hasRenderableShell(model) && !preloadImage && !title && !siteName) {
      return null;
    }

    // Always warm the LCP image even when the matched family template does not paint it:
    // the BOOTED page still renders it above the fold, so it is that page's LCP (dropping
    // this doubled /about's LCP, 5.7s → 11.4s). Preloading here is what makes it
    // request-discoverable in the initial HTML instead of after the theme JS chain.
    if (preloadImage) {
      preload(preloadImage.href, {
        as: 'image',
        fetchPriority: 'high',
        ...(preloadImage.imageSrcSet ? { imageSrcSet: preloadImage.imageSrcSet } : {}),
        ...(preloadImage.imageSizes ? { imageSizes: preloadImage.imageSizes } : {}),
      });
    }

    // Theme-owned shell: the template matched for THIS document's family (slug/layout
    // rules — see SsrShellTemplateMatcher) renders the above-the-fold markup in the
    // theme's own design for that page family.
    const themeShell = shellConfig
      ? await SsrShellThemeTemplateLoader.load(
          theme,
          {
            slug: SsrContentShellService.readSlug(content),
            layout: ResolvedContentShape.resolveLayoutName((content as Record<string, unknown> | null) || null),
          },
          shellConfig,
        )
      : null;

    // XSS-safe by construction: SsrShellTemplateService HTML-escapes EVERY substituted
    // value server-side, list items included; the css is the theme's own file, inlined
    // exactly like the theme CSS in theme-assets.tsx.
    if (themeShell) {
      SsrShellFontPreloader.preloadAll(themeShell.config.fonts, assetBaseUrl, themeSlug, theme?.version);
      const themeAssetBase = ApiPathUtils.themeUiAssetUrl(assetBaseUrl, themeSlug, '');
      const tokens = SsrShellTemplateService.buildTokens(model, themeShell.config, preloadImage, themeAssetBase);
      const html = SsrShellTemplateService.render(themeShell.html, tokens, model.lists);
      // The css is token-rendered too, so the theme can reference its own served assets
      // via `url('{{themeAssetBase}}/…')` without hardcoding a host; `themeAssetBase` is
      // framework-built, substituted RAW (css URL).
      const css = themeShell.css
        ? SsrShellTemplateService.render(themeShell.css, {}, {}, { themeAssetBase })
        : '';
      return (
        <div id={SHELL.ELEMENT_ID} {...{ [SHELL.KIND_ATTRIBUTE]: 'theme' }}>
          {css ? <style dangerouslySetInnerHTML={{ __html: css }} /> : null}
          <div dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      );
    }

    // Framework fallback shell. It renders only what the framework itself knows: the
    // site name and the document title (plus the theme-flagged LCP image, so the preload
    // above still has a paint). Anything richer is a theme's job — it declares a template.
    return (
      <div id={SHELL.ELEMENT_ID}>
        {siteName ? (
          <header className={`${SHELL.CLASS_PREFIX}bar`}>
            <span className={`${SHELL.CLASS_PREFIX}brand`}>{siteName}</span>
          </header>
        ) : null}
        <main className={`${SHELL.CLASS_PREFIX}main`}>
          {title ? <h1>{title}</h1> : null}
          {preloadImage ? (
            /* Server-painted LCP. Fixed-height cover geometry (globals.css) — the box
               never resizes when the image arrives, so it contributes zero CLS. The theme
               reuses the same URL/srcset, so its own render is a cache hit. */
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className={`${SHELL.CLASS_PREFIX}preload-img`}
              src={preloadImage.href}
              srcSet={preloadImage.imageSrcSet}
              sizes={preloadImage.imageSrcSet ? preloadImage.imageSizes : undefined}
              alt=""
              fetchPriority="high"
              decoding="async"
            />
          ) : null}
        </main>
      </div>
    );
  } catch (error) {
    // Non-critical paint placeholder — never let it break the page render.
    console.error('[SsrContentShell] Error:', error);
    return null;
  }
}

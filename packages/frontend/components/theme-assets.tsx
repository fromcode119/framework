import { preconnect, preload } from 'react-dom';
import { ServerApiUtils } from '@/lib/server-api';
import { ApiPathUtils } from '@fromcode119/core/client';

/**
 * Server Component: injects active theme CSS and head link hints into <head>.
 *
 * Theme JS entry is intentionally NOT injected here because it can execute
 * before the frontend runtime bridge initializes `window.React/window.Fromcode`.
 * JS is loaded client-side via PluginsProvider.loadConfig().
 *
 * Themes may declare `ui.headLinks` in theme.json to inject resource hints
 * (preconnect, preload) and stylesheets (e.g. Google Fonts) directly into
 * <head> without a render-blocking @import waterfall inside theme CSS.
 *
 * @example theme.json
 * ```json
 * "ui": {
 *   "headLinks": [
 *     { "rel": "preconnect", "href": "https://fonts.googleapis.com" },
 *     { "rel": "preconnect", "href": "https://fonts.gstatic.com", "crossOrigin": "anonymous" },
 *     { "rel": "stylesheet", "href": "https://fonts.googleapis.com/css2?...", "precedence": "low" }
 *   ]
 * }
 * ```
 */
export default async function ThemeAssets() {
  try {
    const config = await ServerApiUtils.serverFetchJson(ServerApiUtils.buildSystemFrontendPath()) as Record<string, any>;
    const theme = config?.activeTheme;

    if (!theme?.slug) {
      return null;
    }

    const rawEntryUrl = String(theme.ui?.entry || '').trim();
    const absoluteEntryUrl = rawEntryUrl.startsWith('http') ? rawEntryUrl : '';
    const derivedApiUrl = absoluteEntryUrl ? new URL(absoluteEntryUrl).origin : '';
    const apiUrl = derivedApiUrl || ServerApiUtils.buildPublicApiBaseUrl();
    const entryUrl = rawEntryUrl
      ? (absoluteEntryUrl || ApiPathUtils.themeUiAssetUrl(apiUrl, theme.slug, rawEntryUrl))
      : '';

    // Tell browser to preconnect to API origin early — reduces DNS+TCP overhead
    // for all API calls (plugin bundles, theme JS, images, endpoints).
    if (apiUrl) {
      preconnect(apiUrl, { crossOrigin: 'anonymous' });
    }

    // NOTE: No explicit preload for entryUrl here.
    // React 19 intercepts all <link rel="preload|modulepreload"> elements and converts
    // them to :HL RSC directives that omit crossOrigin for script resources. This causes
    // the browser to fetch bundle.js twice: once as no-CORS (preload) and once as CORS
    // (import()). Removing the preload avoids the double-download at the cost of ~100ms
    // earlier fetch. The bundle is fetched once via import() in plugin-loader.tsx.

    const headLinks = Array.isArray(theme.ui?.headLinks)
      ? theme.ui.headLinks.map((link: Record<string, string>, i: number) => {
          if (!link?.rel || !link?.href) return null;
          const href = link.href.startsWith('http') ? link.href : `${apiUrl}${link.href}`;
          if (link.rel === 'preload') {
            preload(href, {
              as: (link.as || 'fetch') as Parameters<typeof preload>[1]['as'],
              type: link.type,
              crossOrigin: link.crossOrigin,
              fetchPriority: link.fetchPriority as 'high' | 'low' | 'auto' | undefined,
            } as Parameters<typeof preload>[1]);
            return null;
          }
          // External stylesheets (e.g. Google Fonts) are injected via DOM script below — not here
          if (link.rel === 'stylesheet' && href.startsWith('https://')) return null;
          const props: Record<string, string> = { rel: link.rel, href };
          if (link.crossOrigin) props.crossOrigin = link.crossOrigin;
          if (link.as) props.as = link.as;
          if (link.type) props.type = link.type;
          if (link.media) props.media = link.media;
          if (link.precedence) props.precedence = link.precedence;
          if (link.fetchPriority) props.fetchPriority = link.fetchPriority;
          return <link key={`hl-${i}`} {...props} />;
        })
      : [];

    // Collect external stylesheets for non-blocking injection via DOM script (media="print" trick)
    const externalStylesheets = Array.isArray(theme.ui?.headLinks)
      ? theme.ui.headLinks
          .filter((link: Record<string, string>) => link?.rel === 'stylesheet' && link?.href?.startsWith('https://'))
          .map((link: Record<string, string>) => link.href)
      : [];

    // Fetch theme CSS server-side and inline as <style> to eliminate render-blocking
    // external stylesheet. Server-to-server fetch has near-zero latency.
    // Falls back to <link rel="stylesheet"> if fetch fails.
    let inlinedCss = '';
    let cssLoadFailed = false;
    if (Array.isArray(theme.ui?.css) && theme.ui.css.length > 0) {
      try {
        const internalBase = ServerApiUtils.buildInternalApiBaseUrl();
        const cssResults = await Promise.all(
          (theme.ui.css as string[]).map(async (cssPath) => {
            const publicHref = cssPath.startsWith('http') ? cssPath : ApiPathUtils.themeUiAssetUrl(apiUrl, theme.slug, cssPath);
            const internalHref = publicHref.replace(apiUrl, internalBase);
            const response = await fetch(internalHref, { next: { revalidate: 3600 } });
            return response.ok ? response.text() : Promise.resolve('');
          })
        );
        inlinedCss = cssResults.join('\n');
      } catch {
        cssLoadFailed = true;
      }
    }

    const fallbackCssLinks = cssLoadFailed && Array.isArray(theme.ui?.css)
      ? (theme.ui.css as string[]).map((cssPath) => {
          const href = cssPath.startsWith('http') ? cssPath : ApiPathUtils.themeUiAssetUrl(apiUrl, theme.slug, cssPath);
          return <link key={href} rel="stylesheet" href={href} />;
        })
      : [];

    return (
      <>
        {headLinks}
        {fallbackCssLinks}
        {inlinedCss ? <style data-theme={theme.slug} dangerouslySetInnerHTML={{ __html: inlinedCss }} /> : null}
        {entryUrl ? <meta name="fromcode:theme-entry" content={entryUrl} /> : null}
        {entryUrl ? (
          // Use an inline script to insert the modulepreload link and non-blocking external
          // stylesheets (Google Fonts) so React 19's resource-hoisting cannot interfere.
          // modulepreload: bypasses crossOrigin stripping that would cause credentials-mode mismatch.
          // stylesheets: media="print" trick defers rendering until after fonts load — no FCP penalty.
          <script dangerouslySetInnerHTML={{ __html:
            `(function(){var l=document.createElement('link');l.rel='modulepreload';l.href=${JSON.stringify(entryUrl)};document.head.appendChild(l);${
              externalStylesheets.length > 0
                ? externalStylesheets.map((href: string) =>
                    `var f=document.createElement('link');f.rel='stylesheet';f.href=${JSON.stringify(href)};f.media='print';f.onload=function(){f.media='all';f.onload=null;};document.head.appendChild(f);`
                  ).join('')
                : ''
            }})();`
          }} />
        ) : null}
      </>
    );
  } catch (error) {
    console.error('[ThemeAssets] Error:', error);
    return null;
  }
}

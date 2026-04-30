import { preload } from 'react-dom';
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

    const apiUrl = ServerApiUtils.buildPublicApiBaseUrl();
    const entryUrl = String(theme.ui?.entry || '').trim()
      ? (String(theme.ui.entry).startsWith('http') ? String(theme.ui.entry) : ApiPathUtils.themeUiAssetUrl(apiUrl, theme.slug, String(theme.ui.entry)))
      : '';

    const headLinks = Array.isArray(theme.ui?.headLinks)
      ? theme.ui.headLinks.map((link: Record<string, string>, i: number) => {
          if (!link?.rel || !link?.href) return null;
          const props: Record<string, string> = { rel: link.rel, href: link.href };
          if (link.crossOrigin) props.crossOrigin = link.crossOrigin;
          if (link.as) props.as = link.as;
          if (link.type) props.type = link.type;
          if (link.media) props.media = link.media;
          if (link.precedence) props.precedence = link.precedence;
          return <link key={`hl-${i}`} {...props} />;
        })
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

    const eagerPlugins = Array.isArray(config?.plugins)
      ? (config.plugins as Array<Record<string, any>>).filter((p) => {
          const strategy = String(p?.ui?.loadStrategy || 'eager').trim();
          return strategy === 'eager' && p?.ui?.entry;
        })
      : [];

    // Use react-dom preload() to emit deduplicated :HL hints without creating
    // duplicate <link> elements (React 19 would otherwise hoist the JSX <link>
    // AND keep it inline, resulting in each preload appearing twice in the HTML).
    if (entryUrl) {
      preload(entryUrl, { as: 'script', fetchPriority: 'high' } as Parameters<typeof preload>[1]);
    }
    eagerPlugins.forEach((plugin) => {
      const pluginEntry = String(plugin.ui.entry);
      const pluginUrl = pluginEntry.startsWith('http')
        ? pluginEntry
        : `${apiUrl}/api/v1/plugins/${String(plugin.slug)}/ui/${pluginEntry}`;
      preload(pluginUrl, { as: 'script', crossOrigin: 'anonymous' } as Parameters<typeof preload>[1]);
    });

    return (
      <>
        {headLinks}
        {fallbackCssLinks}
        {inlinedCss ? <style data-theme={theme.slug} dangerouslySetInnerHTML={{ __html: inlinedCss }} /> : null}
        {entryUrl ? <meta name="fromcode:theme-entry" content={entryUrl} /> : null}
      </>
    );
  } catch (error) {
    console.error('[ThemeAssets] Error:', error);
    return null;
  }
}

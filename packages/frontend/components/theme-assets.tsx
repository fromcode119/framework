import { ServerApiUtils } from '@/lib/server-api';
import { ApiPathUtils } from '@fromcode119/core/client';

/**
 * Server Component: injects active theme CSS into <head>.
 *
 * Theme JS entry is intentionally NOT injected here because it can execute
 * before the frontend runtime bridge initializes `window.React/window.Fromcode`.
 * JS is loaded client-side via PluginsProvider.loadConfig().
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

    const cssLinks = Array.isArray(theme.ui?.css)
      ? theme.ui.css.map((cssPath: string) => {
          const href = cssPath.startsWith('http') ? cssPath : ApiPathUtils.themeUiAssetUrl(apiUrl, theme.slug, cssPath);
          return <link key={href} rel="stylesheet" href={href} />;
        })
      : [];

    return (
      <>
        {cssLinks}
        {entryUrl ? <meta name="fromcode:theme-entry" content={entryUrl} /> : null}
      </>
    );
  } catch (error) {
    console.error('[ThemeAssets] Error:', error);
    return null;
  }
}

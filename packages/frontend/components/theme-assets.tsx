import { ServerApiUtils } from '@/lib/server-api';

const THEMES_BASE_PATH = '/themes';

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
    const baseThemeUrl = `${apiUrl}${THEMES_BASE_PATH}/${theme.slug}`;

    const cssLinks = Array.isArray(theme.ui?.css)
      ? theme.ui.css.map((cssPath: string) => {
          const href = cssPath.startsWith('http') ? cssPath : `${baseThemeUrl}/ui/${cssPath}`;
          return <link key={href} rel="stylesheet" href={href} />;
        })
      : [];

    return <>{cssLinks}</>;
  } catch (error) {
    console.error('[ThemeAssets] Error:', error);
    return null;
  }
}

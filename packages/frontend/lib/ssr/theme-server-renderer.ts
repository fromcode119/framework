import { ServerApiUtils } from '@/lib/server-api';
import { FrontendConfigCache } from '@/lib/frontend-config-cache';
import { ThemePrefetchRequestCache } from '@/lib/theme/theme-prefetch-request-cache';
import { PageDocPrefetchRequestCache } from '@/lib/theme/page-doc-prefetch-request-cache';
import { FrontendTranslationsCache } from '@/lib/frontend-translations-cache';
import { ThemeRenderHost } from '@/lib/ssr/host/theme-render-host';
import { ThemeRenderHostPool } from '@/lib/ssr/host/theme-render-host-pool';
import { ThemeRenderSettings } from '@/lib/ssr/host/theme-render-settings';
import { ThemeInProcessWorlds } from '@/lib/ssr/theme-in-process-worlds';
import { ThemeSsrGeneration } from '@/lib/ssr/theme-ssr-generation';
import { ThemeSsrMarkup } from '@/lib/ssr/theme-ssr-markup';
import { ThemeSsrRuntime } from '@/lib/ssr/theme-ssr-runtime';
import { ThemeWorldBuilder } from '@/lib/ssr/theme-world-builder';
import { ThemeWorldRenderer } from '@/lib/ssr/theme-world-renderer';
import type { IThemeRenderRequest } from '@/lib/ssr/host/interfaces/theme-render-request.interface';

/**
 * Renders the active theme's layout AND the page's block flow to HTML on the server, so the storefront
 * ships painted pixels — navbar, logo, background, the page's blocks, footer — instead of the empty
 * shell it served before, where every pixel waited on hydration.
 *
 * Two artifacts feed it, both produced by `build-plugins.sh` and both mounted read-only:
 * `themes/<slug>/ui-ssr/entry.mjs` supplies the layouts, `plugins/<slug>/ui-ssr/entry.mjs` supplies the
 * storefront slot components — above all the content block flow, which owns everything inside the layout.
 *
 * WHERE the world lives (T5b): in a render host process of its own when this deployment shipped the
 * guest bundle (`ThemeRenderHost.available`), so a theme that throws, hangs or leaks cannot take the
 * storefront down; inside this process otherwise — `next dev`, or a build that skipped
 * `build:frontend-host` — and that fallback is said out loud once, because it is the weaker mode.
 *
 * Every failure path returns null, and null means the page renders exactly as it did before this class
 * existed. Server rendering must never be able to take the storefront down.
 */
export class ThemeServerRenderer {
  private static inProcessWarned = false;

  static async render(args: {
    content: unknown;
    locale: string;
    contentClassName: string;
    notFoundPath?: string;
    contentStyle: Record<string, string> | null;
  }): Promise<ThemeSsrMarkup | null> {
    try {
      return await ThemeServerRenderer.renderOrThrow(args);
    } catch (error) {
      console.warn('[frontend] Theme server render skipped:', (error as Error)?.message || error);
      return null;
    }
  }

  private static async renderOrThrow(args: {
    content: unknown;
    locale: string;
    contentClassName: string;
    notFoundPath?: string;
    contentStyle: Record<string, string> | null;
  }): Promise<ThemeSsrMarkup | null> {
    const { content, locale, contentClassName, contentStyle, notFoundPath } = args;
    // Started before anything is awaited: neither depends on the config or the theme, and both are
    // per-request cached, so kicking them off here overlaps their round-trips with the theme boot
    // instead of adding two more serial hops to TTFB — which is 12% of this page's LCP.
    const translationsRequest = FrontendTranslationsCache.read(locale);
    // BOTH prefetch passes, exactly what the browser receives: the theme's page-agnostic entries (its
    // navigation menus) AND the page-scoped ones. Seeding only the page-scoped half left the theme's
    // navbar and footer reading `null` during render, so they painted their STATIC fallback menu and the
    // real navigation appeared only after the client booted — a visible change on every first load.
    const prefetchRequest = Promise.all([
      ThemePrefetchRequestCache.read(),
      PageDocPrefetchRequestCache.read(content),
    ]).then(([themeWide, pageScoped]) => ({ ...themeWide, ...pageScoped }));

    const config = (await FrontendConfigCache.read()) || {};
    // The installed artifact versions, read off the config this render already needed — no extra fetch.
    const generation = ThemeSsrGeneration.from(config);
    if (!generation.themeSlug) return null;
    const settings = ThemeRenderSettings.from(config);
    const publicApiBaseUrl = ServerApiUtils.buildPublicApiBaseUrl();
    const [serverTranslations, prefetched] = await Promise.all([translationsRequest, prefetchRequest]);
    const request: IThemeRenderRequest = { content, locale, contentClassName, contentStyle, notFoundPath, config, serverTranslations, prefetched };

    const frontendDir = process.cwd();
    if (ThemeRenderHost.available(frontendDir)) {
      return ThemeRenderHostPool.render({
        generation,
        settings,
        frontendDir,
        boot: { config, publicApiBaseUrl, themesDir: ThemeSsrRuntime.themesDir(), pluginsDir: ThemeSsrRuntime.pluginsDir(), frontendDir },
        request,
      });
    }

    if (!ThemeServerRenderer.inProcessWarned) {
      ThemeServerRenderer.inProcessWarned = true;
      console.warn(`[frontend] theme render hosts are not available (${ThemeRenderHost.GUEST_MAIN} not built): worlds render INSIDE the storefront process, so a theme fault can take the storefront down.`);
    }
    const runtime = await ThemeInProcessWorlds.boot(generation, settings.generationCap, publicApiBaseUrl);
    if (!runtime) return null;
    return ThemeWorldRenderer.render({ runtime, signature: generation.signature, themeSlug: generation.themeSlug, ...request });
  }

  /** Slugs of the plugins that ship a server bundle here — the ones whose registrations the server render sees in full. */
  static pluginsWithServerBundle(): string[] {
    return ThemeWorldBuilder.pluginsWithServerBundle();
  }
}

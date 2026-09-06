import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ApplicationUrlUtils, InternalServiceAuth } from '@fromcode119/core/client';
import { FrontendConfigCache } from '@/lib/frontend-config-cache';
import { ThemeSsrRuntime } from '@/lib/ssr/theme-ssr-runtime';
import { FrontendRuntimeAssetManifest } from '@/lib/document/frontend-runtime-asset-manifest';
import { StorefrontDocumentProxy } from '@/lib/document/storefront-document-proxy';

/**
 * What THIS process can actually see of the extensions it renders from.
 *
 * Server rendering depends on files the frontend reads off disk — `themes/<slug>/ui-ssr/entry.mjs` and
 * each `plugins/<slug>/ui-ssr/entry.mjs` — and every failure to load one is deliberately non-fatal, so
 * the page still renders, just empty. That makes the difference between "the theme package has no
 * server bundle", "this container has no themes volume", and "the api and the frontend are looking at
 * two different directories" completely invisible from outside: all three produce the same
 * content-free HTML. This endpoint states which one it is.
 *
 * It answers a question nobody could ask remotely before: an operator (or the admin, or an MCP client)
 * could restart the frontend but never see WHY it renders nothing. Diagnosing it required shell access
 * to the container.
 *
 * Same contract as the restart route: called by the api, never by a browser, authenticated with the
 * shared internal secret — the paths and directory names it reports are deployment layout, not public
 * information. Read-only; it touches nothing.
 */
export class InternalSsrStatusRoute {
  static async GET(request: Request): Promise<Response> {
    if (!InternalServiceAuth.authorize(request.headers.get(InternalServiceAuth.HEADER))) {
      return Response.json({ app: ApplicationUrlUtils.FRONTEND_APP, reason: 'Not authorized.' }, { status: 403 });
    }

    const themesDir = ThemeSsrRuntime.themesDir();
    const pluginsDir = ThemeSsrRuntime.pluginsDir();
    const config = (await FrontendConfigCache.read()) || {};
    const themeSlug = String((config.activeTheme as Record<string, unknown> | null)?.slug || '');
    const themeEntry = themeSlug && themesDir ? join(themesDir, themeSlug, 'ui-ssr', 'entry.mjs') : '';

    return Response.json({
      // Names itself, exactly as the restart route does, so the caller knows the frontend answered.
      app: ApplicationUrlUtils.FRONTEND_APP,
      themesDir,
      pluginsDir,
      activeTheme: themeSlug,
      themeSsrEntry: themeEntry,
      themeSsrEntryExists: Boolean(themeEntry) && existsSync(themeEntry),
      pluginSsrBundles: InternalSsrStatusRoute.pluginBundleSlugs(pluginsDir),
      // Islands rollout: whether content paths are served as static documents, and which runtime they load.
      documentMode: StorefrontDocumentProxy.enabled() ? 'islands' : 'app-router',
      runtimeScript: FrontendRuntimeAssetManifest.runtimeScriptPath(),
      runtimeHash: FrontendRuntimeAssetManifest.runtimeHash(),
      // The whole point: one sentence an operator can act on, rather than a set of fields to interpret.
      diagnosis: InternalSsrStatusRoute.diagnose(themesDir, themeSlug, themeEntry),
    });
  }

  /** Plugin slugs that ship a server bundle this process can see. */
  private static pluginBundleSlugs(pluginsDir: string): string[] {
    if (!pluginsDir || !existsSync(pluginsDir)) return [];
    return readdirSync(pluginsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((slug) => existsSync(join(pluginsDir, slug, 'ui-ssr', 'entry.mjs')));
  }

  private static diagnose(themesDir: string, themeSlug: string, themeEntry: string): string {
    if (!themesDir) {
      return 'THEMES_DIR is not set on this frontend process, so it cannot read any theme. Server rendering is off for every page. Set THEMES_DIR (and mount the themes volume) on the frontend service.';
    }
    if (!existsSync(themesDir)) {
      return `THEMES_DIR is set to "${themesDir}" but that directory does not exist in this container — the themes volume is not mounted here. Server rendering is off for every page.`;
    }
    if (!themeSlug) {
      return 'No active theme resolved from the api config, so there is nothing to render.';
    }
    if (!existsSync(themeEntry)) {
      return `The active theme "${themeSlug}" has no server bundle at ${themeEntry} in THIS container. Either the installed theme package ships no ui-ssr/, or the api installed it into a directory this process does not share. Server rendering is off for every page.`;
    }
    return 'The active theme\'s server bundle is present and readable.';
  }
}

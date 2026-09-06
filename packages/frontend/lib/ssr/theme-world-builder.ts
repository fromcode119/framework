import { existsSync, readdirSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { ServerApiBridge } from '@/lib/ssr/server-api-bridge';
import { ThemeServerRegistry } from '@/lib/ssr/theme-server-registry';
import { ThemeSsrGeneration } from '@/lib/ssr/theme-ssr-generation';
import { ThemeSsrRuntime } from '@/lib/ssr/theme-ssr-runtime';

/**
 * Builds one server-render WORLD: loads the runtime module world, installs the capturing bridge,
 * imports the theme's and every plugin's storefront server bundle, resolves the lazily-registered
 * block renderers, and publishes the result under the generation's signature.
 *
 * Runs in whichever process owns the world — a theme render host (one world per process, T5b) or,
 * without one, the storefront process itself. Same code either way, so a page renders the same
 * whether or not it was rendered out of process.
 *
 * Done ONCE per set of installed artifact versions rather than once per process. Keying it by version
 * is what makes a theme or plugin update take effect on the storefront: before this, an install had to
 * be followed by an SSH `docker restart` or the frontend went on rendering the bundles it imported at
 * boot — and if the artifact had not existed then, went on rendering nothing at all.
 */
export class ThemeWorldBuilder {
  /**
   * Counts boots, and every bundle URL carries the count.
   *
   * Node's ESM cache is keyed by URL and a cached module does NOT re-run — and registration is a side
   * effect of running. A generation is published from an EMPTY registry, so any bundle Node answered
   * from cache would simply be missing from the new world. Keying the URL on the version alone was not
   * enough: reverting to a version this process had already booted replayed the cached modules,
   * nothing registered, and the storefront went back to serving an empty body. The counter makes every
   * boot's URLs new, so the registrations always run.
   */
  private static boots = 0;

  /** Returns null when the theme itself could not be loaded — without layouts there is nothing to render into. */
  static async build(generation: ThemeSsrGeneration, publicApiBaseUrl: string): Promise<ThemeSsrRuntime | null> {
    ThemeWorldBuilder.boots += 1;
    // Unique to this boot, so no bundle can be answered from Node's module cache. See `boots`.
    const cacheBuster = `${generation.token}-${ThemeWorldBuilder.boots}`;
    const runtime = await ThemeSsrRuntime.load();
    // The PUBLIC api base, not the internal one: plugin clients bake it into `<img src>` / `srcset`
    // attributes that the BROWSER then requests, so it has to be the URL a visitor can reach.
    ThemeServerRegistry.install(runtime.contextBridge, new ServerApiBridge(publicApiBaseUrl));

    // Everything the re-imported bundles register lands here, not in the live state, until the whole
    // generation is built — so requests arriving mid-rebuild keep rendering against the previous world
    // instead of a half-populated one.
    const state = ThemeServerRegistry.beginGeneration();
    const themeSlug = generation.themeSlug;
    const themeEntry = join(ThemeSsrRuntime.themesDir(), themeSlug, 'ui-ssr', 'entry.mjs');
    if (!(await ThemeWorldBuilder.importBundle(themeEntry, cacheBuster)) || !state.payloadFor(themeSlug)) {
      ThemeServerRegistry.discardGeneration(state);
      // Say so, LOUDLY. Without the theme's server bundle there is no server rendering AT ALL — every
      // page ships a content-free body — and until this line existed that catastrophic state looked
      // exactly like a healthy boot: no error, no warning, just empty HTML. A theme packaged by tooling
      // that drops `ui-ssr/**` produces precisely this, and it cost two production deploys to spot.
      // Named by generation, because on a multi-tenant deployment this is ONE site's problem: an operator
      // with fifty sites has to know whose storefront is serving an empty body, not just which theme.
      console.error(
        `[frontend] NO SERVER RENDERING for ${generation.signature}: theme "${themeSlug}" registered no layouts from ` +
        `${themeEntry}. Every page of a site on this theme will serve an empty body until the theme package ships that bundle.`,
      );
      return null;
    }

    // Plugins are imported AFTER the theme so a theme override, registered at the higher priority,
    // still wins — the browser load order this mirrors is the same.
    await Promise.all(ThemeWorldBuilder.pluginEntries().map((entry) => ThemeWorldBuilder.importBundle(entry, cacheBuster)));
    await state.warmOverrides((component) => runtime.wrapOverride(component));
    ThemeServerRegistry.publishGeneration(generation.signature, state);
    console.info(`[frontend] SSR bundles loaded for ${generation.signature} (${ThemeServerRegistry.publishedSignatures().length} resident in pid ${process.pid})`);
    return runtime;
  }

  /** Slugs of the plugins that ship a server bundle here — the ones whose registrations the server render sees in full. */
  static pluginsWithServerBundle(): string[] {
    return ThemeWorldBuilder.pluginEntries().map((entry) => basename(dirname(dirname(entry))));
  }

  /** Every `plugins/<slug>/ui-ssr/entry.mjs` on disk. A plugin without one simply renders client-side. */
  private static pluginEntries(): string[] {
    const pluginsDir = ThemeSsrRuntime.pluginsDir();
    if (!pluginsDir || !existsSync(pluginsDir)) return [];
    return readdirSync(pluginsDir, { withFileTypes: true })
      .filter((item) => item.isDirectory())
      .map((item) => join(pluginsDir, item.name, 'ui-ssr', 'entry.mjs'))
      .filter((entry) => existsSync(entry));
  }

  /**
   * Import one bundle for this boot. There is deliberately NO cache in front of this: `build` runs once
   * per generation and asks for each bundle once, so a memo would only ever serve a STALE answer across
   * boots — including the "this file does not exist" answer that kept the frontend rendering nothing
   * after a theme update had already fixed it.
   */
  private static async importBundle(entry: string, cacheBuster: string): Promise<boolean> {
    if (!existsSync(entry)) return false;
    try {
      await ThemeSsrRuntime.importRuntimeModule(entry, cacheBuster);
      return true;
    } catch (error) {
      // One bundle that will not load server-side must not cost the page the rest of them.
      console.warn(`[frontend] SSR bundle not loaded (${entry}):`, (error as Error)?.message || error);
      return false;
    }
  }
}

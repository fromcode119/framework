import { AdminConstants } from '@/lib/constants/admin.constants';
import { IAdminPluginMetadata } from '@/app/interfaces/admin-plugin-metadata.interface';
import type { IPluginAssetLoaderCallbacks } from '@/app/services/interfaces/plugin-asset-loader-callbacks.interface';
import type { IPluginAssetLoaderContext } from '@/app/services/interfaces/plugin-asset-loader-context.interface';

/**
 * Applies plugin admin metadata to the running document: replaces/registers collections,
 * injects modulepreload + stylesheet links, and fires the dynamic imports that register
 * plugin slot components. Mirrors the imperative logic that previously lived inline in
 * the PluginLoader effect — kept byte-for-byte equivalent.
 */
export class PluginAssetLoaderService {
  private static loadedPluginEntryUrls = new Set<string>();
  private static loadedPluginCssUrls = new Set<string>();

  static apply(ctx: IPluginAssetLoaderContext): void {
    const { plugins, refreshVersion, callbacks } = ctx;
    if (!Array.isArray(plugins)) return;

    void refreshVersion;
    PluginAssetLoaderService.applyCollections(plugins, callbacks);
    PluginAssetLoaderService.injectAssetLinks(plugins);
    PluginAssetLoaderService.importEntries(plugins, callbacks);
  }

  private static applyCollections(plugins: IAdminPluginMetadata[], callbacks: IPluginAssetLoaderCallbacks): void {
    const hasCompleteCollectionMetadata = plugins.every((plugin) =>
      plugin?.admin && Array.isArray(plugin.admin.collections)
    );
    const nextCollections = plugins.flatMap((plugin) =>
      Array.isArray(plugin?.admin?.collections)
        ? plugin.admin!.collections!.map((collection: any) => ({
            ...collection,
            pluginSlug: collection?.pluginSlug || plugin.slug,
          }))
        : []
    );

    if (typeof callbacks.replaceCollections === 'function' && hasCompleteCollectionMetadata) {
      callbacks.replaceCollections(nextCollections);
    } else if (!hasCompleteCollectionMetadata) {
      console.warn('[Admin] Skipping collection replacement because plugin metadata is incomplete.');
    } else {
      for (const collection of nextCollections) {
        callbacks.registerCollection(collection);
      }
    }
  }

  private static injectAssetLinks(plugins: IAdminPluginMetadata[]): void {
    // Pass 1: add all modulepreload and CSS links before any dynamic import.
    // The entryUrl/cssUrl already carry their own `?v=<mtime>` cache-buster from
    // admin-metadata-service, so we do NOT append the volatile refreshVersion — doing
    // so changed the URL on every refresh tick and re-imported an unchanged bundle,
    // re-registering slots and remounting the plugin page (a visible flash).
    for (const plugin of plugins) {
      const entryUrl = plugin.ui?.entryUrl;
      if (entryUrl) {
        const src = `${AdminConstants.API_BASE_URL}${entryUrl}`;
        if (!PluginAssetLoaderService.loadedPluginEntryUrls.has(src)) {
          document.querySelectorAll(`link[rel="modulepreload"][data-plugin="${plugin.slug}"]`).forEach(el => el.remove());
          const link = document.createElement('link');
          link.rel = 'modulepreload';
          link.href = src;
          link.setAttribute('data-plugin', plugin.slug);
          document.head.appendChild(link);
        }
      }

      if (plugin.ui?.cssUrls) {
        plugin.ui.cssUrls.forEach((cssUrl, index) => {
          const href = `${AdminConstants.API_BASE_URL}${cssUrl}`;
          console.debug(`[Admin] Loading plugin CSS from: ${href}`);
          if (!PluginAssetLoaderService.loadedPluginCssUrls.has(href)) {
            PluginAssetLoaderService.loadedPluginCssUrls.add(href);
            document.querySelectorAll(`link[rel="stylesheet"][data-plugin="${plugin.slug}"][data-index="${index}"]`).forEach(el => el.remove());
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            link.setAttribute('data-plugin', plugin.slug);
            link.setAttribute('data-index', index.toString());
            // PREPEND, never append. A plugin's stylesheet carries the Tailwind utilities its own
            // components use, and the admin uses many of the same ones. Appended, a plugin's plain
            // `.flex-col` is the LAST declaration in the document and so beats the admin's
            // `@media(min-width:1024px){.lg\:flex-row}` — equal specificity, later wins — and the
            // admin shell collapses to a single column with the sidebar overlaying the page.
            // Prepending puts every plugin sheet ahead of the admin's own, so the admin wins each
            // tie for the chrome it owns while a plugin's UNIQUE classes still apply, since nothing
            // else declares them. Same rule the storefront already follows for plugin default CSS.
            PluginAssetLoaderService.prependStylesheet(link);
          }
        });
      }
    }
  }

  /**
   * Put a plugin stylesheet ahead of the admin's own, and after any plugin sheet already placed.
   *
   * Inserting before `head.firstChild` would reverse the plugins relative to each other on every
   * load; keeping them in arrival order means two plugins that declare the same class resolve the
   * same way every time rather than by whichever happened to be injected last.
   */
  private static prependStylesheet(link: HTMLLinkElement): void {
    const placed = document.head.querySelectorAll('link[rel="stylesheet"][data-plugin]');
    const last = placed[placed.length - 1];
    if (last) {
      last.after(link);
      return;
    }
    document.head.prepend(link);
  }

  private static importEntries(plugins: IAdminPluginMetadata[], callbacks: IPluginAssetLoaderCallbacks): void {
    // Pass 2: fire all dynamic imports concurrently. Dedupe on the entryUrl (already
    // mtime-versioned) so a bundle is imported at most once per session — a genuine
    // update yields a new entryUrl (new mtime) and re-imports correctly.
    for (const plugin of plugins) {
      const entryUrl = plugin.ui?.entryUrl;
      if (!entryUrl) continue;
      const src = `${AdminConstants.API_BASE_URL}${entryUrl}`;
      if (PluginAssetLoaderService.loadedPluginEntryUrls.has(src)) continue;
      PluginAssetLoaderService.loadedPluginEntryUrls.add(src);

      import(/* webpackIgnore: true */ src).then(module => {
        if (module.init) module.init();
        if (module.slots) {
          Object.entries(module.slots).forEach(([slotName, config]: [string, any]) => {
            const component = typeof config === 'function' ? config : config.component;
            const priority = config.priority || 0;
            callbacks.registerSlotComponent(slotName, component, plugin.slug, priority);
          });
        }
      }).catch(err => {
        console.warn(`[Admin] Failed to dynamic import plugin ${plugin.slug}:`, err);
        if (!document.querySelector(`script[src="${src}"]`)) {
          document.querySelectorAll(`script[data-plugin="${plugin.slug}"][data-type="ui-entry"]`).forEach(el => el.remove());
          const script = document.createElement('script');
          script.type = 'module';
          script.src = src;
          script.async = true;
          script.setAttribute('data-plugin', plugin.slug);
          script.setAttribute('data-type', 'ui-entry');
          document.body.appendChild(script);
        }
      });
    }
  }
}

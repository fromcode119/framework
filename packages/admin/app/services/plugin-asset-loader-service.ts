import { AdminConstants } from '@/lib/constants';
import type { AdminPluginMetadata } from '../plugin-loader.interfaces';
import type { PluginAssetLoaderCallbacks, PluginAssetLoaderContext } from './plugin-asset-loader-service.interfaces';

/**
 * Applies plugin admin metadata to the running document: replaces/registers collections,
 * injects modulepreload + stylesheet links, and fires the dynamic imports that register
 * plugin slot components. Mirrors the imperative logic that previously lived inline in
 * the PluginLoader effect — kept byte-for-byte equivalent.
 */
export class PluginAssetLoaderService {
  private static loadedPluginEntryUrls = new Set<string>();
  private static loadedPluginCssUrls = new Set<string>();

  static apply(ctx: PluginAssetLoaderContext): void {
    const { plugins, refreshVersion, callbacks } = ctx;
    if (!Array.isArray(plugins)) return;

    PluginAssetLoaderService.applyCollections(plugins, callbacks);
    PluginAssetLoaderService.injectAssetLinks(plugins, refreshVersion);
    PluginAssetLoaderService.importEntries(plugins, refreshVersion, callbacks);
  }

  private static applyCollections(plugins: AdminPluginMetadata[], callbacks: PluginAssetLoaderCallbacks): void {
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

  private static injectAssetLinks(plugins: AdminPluginMetadata[], refreshVersion: number): void {
    // Pass 1: add all modulepreload and CSS links before any dynamic import
    for (const plugin of plugins) {
      const entryUrl = plugin.ui?.entryUrl;
      if (entryUrl) {
        const cacheBreaker = refreshVersion > 0 ? `?v=${refreshVersion}` : '';
        const src = `${AdminConstants.API_BASE_URL}${entryUrl}${cacheBreaker}`;
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
          const cacheBreaker = refreshVersion > 0 ? `?v=${refreshVersion}` : '';
          const href = `${AdminConstants.API_BASE_URL}${cssUrl}${cacheBreaker}`;
          console.debug(`[Admin] Loading plugin CSS from: ${href}`);
          if (!PluginAssetLoaderService.loadedPluginCssUrls.has(href)) {
            PluginAssetLoaderService.loadedPluginCssUrls.add(href);
            document.querySelectorAll(`link[rel="stylesheet"][data-plugin="${plugin.slug}"][data-index="${index}"]`).forEach(el => el.remove());
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            link.setAttribute('data-plugin', plugin.slug);
            link.setAttribute('data-index', index.toString());
            document.head.appendChild(link);
          }
        });
      }
    }
  }

  private static importEntries(plugins: AdminPluginMetadata[], refreshVersion: number, callbacks: PluginAssetLoaderCallbacks): void {
    // Pass 2: fire all dynamic imports concurrently
    for (const plugin of plugins) {
      const entryUrl = plugin.ui?.entryUrl;
      if (!entryUrl) continue;
      const cacheBreaker = refreshVersion > 0 ? `?v=${refreshVersion}` : '';
      const src = `${AdminConstants.API_BASE_URL}${entryUrl}${cacheBreaker}`;
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

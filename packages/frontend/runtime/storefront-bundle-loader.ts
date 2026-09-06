import { PluginLoaderMountService } from '@/app/plugin-loader-mount-service';
import type { RuntimeModuleRef } from '@/app/runtime-module-ref';

/**
 * Evaluates the theme bundle and every EAGER plugin bundle before the provider mounts, so their
 * registrations (layouts, slots, overrides, translations) are in the pre-boot queue when the provider's
 * initial state is seeded — the precondition for hydrating the server tree in place.
 *
 * Same URLs as `PluginLoader` builds (one builder, `PluginLoaderMountService`), so the browser never
 * fetches a bundle twice; the keys returned pre-fill that loader's dedupe set. Order mirrors the
 * server (`ThemeServerRenderer.bootOnce`): the theme first, then the plugins. All fetches are warmed
 * up front with `modulepreload`, so the ordering costs evaluation time only, not network time. Idle
 * plugins are NOT loaded here — they keep loading through `PluginLoader` on browser idle, through the
 * live bridge, exactly as before.
 *
 * A bundle that fails to import is logged and skipped, as `PluginLoader.loadModule` does; the page then
 * takes the hydrator's fallback path if that bundle owned the layout or the content slot.
 */
export class StorefrontBundleLoader {
  static async loadEager(theme: any, plugins: any[], apiUrl: string): Promise<Set<string>> {
    const themeRef = PluginLoaderMountService.themeRuntimeModule(theme, apiUrl);
    const pluginRefs = PluginLoaderMountService.pluginRuntimeModules(plugins, apiUrl).filter((ref) => !ref.idle);
    const refs = themeRef ? [themeRef, ...pluginRefs] : pluginRefs;
    refs.forEach(StorefrontBundleLoader.preload);

    const loaded = new Set<string>();
    if (themeRef && await StorefrontBundleLoader.load(themeRef)) loaded.add(themeRef.key);
    const results = await Promise.all(pluginRefs.map((ref) => StorefrontBundleLoader.load(ref)));
    pluginRefs.forEach((ref, index) => { if (results[index]) loaded.add(ref.key); });
    return loaded;
  }

  private static preload(ref: RuntimeModuleRef): void {
    if (document.head.querySelector(`link[rel="modulepreload"][href="${CSS.escape(ref.url)}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'modulepreload';
    link.href = ref.url;
    document.head.appendChild(link);
  }

  private static async load(ref: RuntimeModuleRef): Promise<boolean> {
    try {
      await import(/* webpackIgnore: true */ /* @vite-ignore */ ref.url);
      return true;
    } catch (error) {
      console.error(`[frontend] Failed to import runtime module ${ref.key}:`, error);
      return false;
    }
  }
}

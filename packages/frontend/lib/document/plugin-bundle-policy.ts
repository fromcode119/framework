import { CoercionUtils, PluginFrontendRuntimeUtils } from '@fromcode119/core/client';

/**
 * Which plugin storefront bundles a page can skip. Measured: the ecommerce client site loaded ten plugin
 * bundles (~430 KB) on every page, most of them for plugins the page never rendered. A bundle is skipped
 * only when ALL of these hold, so nothing client-only can vanish:
 *  - the plugin loads on idle (`ui.loadStrategy: 'idle'`) — an eager plugin is the author saying "always";
 *  - the plugin ships a server bundle, so the server render saw its registrations in full and a component
 *    it registers for a slot the page renders WAS counted (`PluginUsageTracker` records at Slot render,
 *    before the component decides what to output);
 *  - the render mounted none of its components;
 *  - the theme does not declare it as a dependency (theme code may call its API without rendering it).
 */
export class PluginBundlePolicy {
  static skippable(args: { plugins: any[]; usedPlugins: string[]; withServerBundle: string[]; themeDependencies: string[] }): string[] {
    const used = new Set(args.usedPlugins.map((slug) => String(slug)));
    const server = new Set(args.withServerBundle.map((slug) => String(slug)));
    const deps = new Set(args.themeDependencies.map((slug) => String(slug)));
    return (args.plugins || [])
      .filter((plugin) => PluginFrontendRuntimeUtils.loadsOwnFrontendRuntime(plugin))
      .filter((plugin) => CoercionUtils.toString(plugin?.ui?.loadStrategy) === 'idle')
      .map((plugin) => CoercionUtils.toString(plugin?.slug))
      .filter((slug) => slug && server.has(slug) && !used.has(slug) && !deps.has(slug))
      .sort();
  }
}

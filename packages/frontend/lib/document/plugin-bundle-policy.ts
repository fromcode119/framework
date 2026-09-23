import { CoercionUtils, PluginFrontendRuntimeUtils } from '@fromcode119/core/client';

/**
 * Which plugin storefront bundles a page can skip. Measured: a client shop loaded ten plugin
 * bundles (~430 KB) on every page, most of them for plugins the page never rendered. A bundle is skipped
 * only when ALL of these hold, so nothing client-only can vanish:
 *  - the plugin loads on idle (`ui.loadStrategy: 'idle'`) — an eager plugin is the author saying "always";
 *  - the plugin ships a server bundle, so the server render saw its registrations in full and a component
 *    it registers for a slot the page renders WAS counted (`PluginUsageTracker` records at Slot render,
 *    before the component decides what to output);
 *  - the render mounted none of its components;
 *  - the theme does not declare it as a dependency (theme code may call its API without rendering it).
 *
 * A `recipe` page skips NOTHING. The server renders its body as an empty box (the design's component is
 * resolved in the browser, see `ThemeSsrContentTree`), so "the render mounted none of its components"
 * is unknowable there — and the plugin that owns the design is exactly one the server never mounted.
 * Skipping it left the policy pages with an empty box where the plugin's design should have painted.
 */
export class PluginBundlePolicy {
  static skippable(args: { plugins: any[]; usedPlugins: string[]; withServerBundle: string[]; themeDependencies: string[]; rendersRecipe?: boolean }): string[] {
    if (args.rendersRecipe) return [];
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

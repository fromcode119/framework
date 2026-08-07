import type { IFromcodePlugin } from '@core/interfaces/fromcode-plugin.interface';

/**
 * PluginModuleResolverService
 *
 * Turns a loaded plugin entry module into the plain lifecycle object the plugin manager consumes.
 *
 * The canonical entry shape is a single `export class <Name>Plugin` whose statics ARE the contract:
 *
 *   export class AnalyticsPlugin {
 *     static onInit = AnalyticsPluginLifecycle.onInit;
 *     static publicAPI = { countActiveViewersForPath: AnalyticsPublicApi.countActiveViewersForPath };
 *   }
 *
 * This service is the bridge that keeps that source pure OOP: it finds the exported class and lifts its
 * contract statics off it, so nothing in the plugin has to hand-write an `export default` binding.
 *
 * Statics are lifted by VALUE, so a lifted static must not use `this` — a static references its own class
 * by NAME (the repo-wide rule). Entry classes only hold references to a lifecycle class, so this holds.
 *
 * The legacy shape (`module.exports = {...}` / `export default {...}`) is still accepted: third-party
 * plugins already installed from the marketplace ship compiled entries in that form, and the CLI scaffold
 * emits plain CommonJS. That path is a compatibility contract for foreign packages, not a shape our own
 * source may use.
 */
export class PluginModuleResolverService {
  /** The keys a plugin entry may contribute — everything else on the class is the plugin's own business. */
  private static readonly CONTRACT_KEYS: readonly (keyof IFromcodePlugin)[] = [
    'manifest',
    'onInstall',
    'onInit',
    'onUpdate',
    'onEnable',
    'onDisable',
    'onUninstall',
    'publicAPI',
  ];

  /** Own-property names every class carries; never part of the plugin contract. */
  private static readonly CLASS_INTRINSICS = new Set(['length', 'name', 'prototype', 'caller', 'arguments']);

  /**
   * Resolve a required/imported plugin entry module to its lifecycle object.
   * Returns `{}` for an empty module so the caller still stages the plugin with its manifest.
   */
  static resolve(rawModule: any): Record<string, any> {
    if (!rawModule) return {};

    const fromClass = PluginModuleResolverService.liftExportedClass(rawModule);
    if (fromClass) return fromClass;

    return rawModule.default ? { ...rawModule.default, ...rawModule } : rawModule;
  }

  /**
   * Find the exported class carrying the plugin contract and lift its statics.
   * Returns null when the module exports no such class, so the caller falls back to the legacy shape.
   */
  private static liftExportedClass(rawModule: any): Record<string, any> | null {
    for (const candidate of PluginModuleResolverService.candidateExports(rawModule)) {
      if (!PluginModuleResolverService.isPluginClass(candidate)) continue;

      const lifted: Record<string, any> = {};
      const owned = new Set(Object.getOwnPropertyNames(candidate));
      for (const key of PluginModuleResolverService.CONTRACT_KEYS) {
        if (owned.has(key)) lifted[key] = candidate[key];
      }
      return lifted;
    }

    return null;
  }

  /** Every value the module exports, with `default` first so an explicit default entry wins. */
  private static candidateExports(rawModule: any): any[] {
    const values: any[] = [];
    if (rawModule.default !== undefined) values.push(rawModule.default);
    for (const key of Object.keys(rawModule)) {
      if (key !== 'default') values.push(rawModule[key]);
    }
    return values;
  }

  /** A class (not a plain function) that declares at least one plugin-contract static. */
  private static isPluginClass(candidate: any): boolean {
    if (typeof candidate !== 'function' || !candidate.prototype) return false;

    const owned = Object.getOwnPropertyNames(candidate)
      .filter((key) => !PluginModuleResolverService.CLASS_INTRINSICS.has(key));

    return PluginModuleResolverService.CONTRACT_KEYS.some((key) => owned.includes(key));
  }
}

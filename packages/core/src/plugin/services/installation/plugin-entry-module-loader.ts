import Module from 'module';
import path from 'path';

/**
 * Loads a plugin's server entry — the EXACT file the scanner resolved, with no second resolution pass.
 *
 * `require(file)` re-resolves the path, and a TypeScript runtime re-points it: under the api's
 * `tsx watch` dev server, `require('/app/plugins/cms/index.js')` loads `index.ts` instead, because tsx
 * maps a `.js` specifier onto its `.ts` sibling. A plugin's source is not runnable — its `@plugin/...`
 * specifiers are a BUILD-time alias that esbuild inlines when packing — so the plugin failed to load
 * with "Cannot find module '@plugin/src/on-init'" while its perfectly good `index.js` sat next to it.
 *
 * Constructing the module and calling `load(filename)` skips resolution entirely: the extension handler
 * runs against the filename we already decided on. Everything else (the module cache, `module.paths`
 * for the plugin's own dependencies) behaves exactly as `require` would.
 */
export class PluginEntryModuleLoader {
  static load(filename: string): unknown {
    const registry = Module as unknown as {
      _cache: Record<string, { exports: unknown }>;
      _nodeModulePaths(dir: string): string[];
    };
    const cached = registry._cache[filename];
    if (cached) return cached.exports;

    const loaded = new Module(filename) as unknown as {
      filename: string;
      paths: string[];
      exports: unknown;
      load(file: string): void;
    };
    loaded.filename = filename;
    loaded.paths = registry._nodeModulePaths(path.dirname(filename));
    registry._cache[filename] = loaded;
    try {
      loaded.load(filename);
    } catch (error) {
      delete registry._cache[filename];
      throw error;
    }
    return loaded.exports;
  }
}

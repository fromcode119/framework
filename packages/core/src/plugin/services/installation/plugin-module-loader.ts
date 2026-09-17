import Module from 'module';
import fs from 'fs';
import path from 'path';
import { PluginEntryModuleLoader } from '@core/plugin/services/installation/plugin-entry-module-loader';

/**
 * Getting a plugin's compiled entry module into this process.
 *
 * Two loaders, and the fallback is the point. `require` is tried first because it shares the module
 * registry the framework is already running — a plugin that pulled its own copy of React or of a
 * framework singleton would break reference identity and fail in ways that look like anything but a
 * second copy. When `require` cannot take the file, a native dynamic import runs instead, which is
 * the only way to load an ES module from CommonJS.
 *
 * Split out of `PluginDirectoryScannerService` (356 lines), which decides WHICH directories hold
 * plugins; this decides how one of them is loaded.
 */
export class PluginModuleLoader {
  constructor(
    private readonly projectRoot: string,
  ) {}

  ensureSharedModuleResolution(): void {
    try {
      const projectNodeModules = path.resolve(this.projectRoot, 'node_modules');
      if (!fs.existsSync(projectNodeModules) || !fs.statSync(projectNodeModules).isDirectory()) return;

      const delimiter = path.delimiter;
      const existing = String(process.env.NODE_PATH || '')
        .split(delimiter)
        .map((entry) => entry.trim())
        .filter(Boolean);

      if (!existing.includes(projectNodeModules)) {
        process.env.NODE_PATH = existing.length > 0
          ? `${projectNodeModules}${delimiter}${existing.join(delimiter)}`
          : projectNodeModules;
        (Module as any)._initPaths();
      }
    } catch {
      // Best effort: plugin resolution still has fallback behavior.
    }
  }

  shouldUseNativeImport(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const code = 'code' in error ? String((error as { code?: unknown }).code || '') : '';
    const message = 'message' in error ? String((error as { message?: unknown }).message || '') : '';

    return code === 'ERR_REQUIRE_ESM'
      || message.includes('Must use import to load ES Module')
      || message.includes('require() of ES Module');
  }

  async nativeImportModule(filePath: string): Promise<any> {
    const { pathToFileURL } = await import('url');
    const dynamicImport = new Function('specifier', 'return import(specifier);');
    return dynamicImport(pathToFileURL(filePath).href);
  }

  async loadPluginModule(indexPath: string): Promise<any> {
    try {
      return PluginEntryModuleLoader.load(indexPath);
    } catch (error: any) {
      if (!this.shouldUseNativeImport(error)) {
        throw error;
      }

      return this.nativeImportModule(indexPath);
    }
  }

  /** Directory names under a root, lowercased; an absent root is simply an empty set. */
  static listDirectoryNames(root: string): Set<string> {
    try {
      return new Set(fs.readdirSync(root)
        .filter((name) => !name.startsWith('.'))
        .map((name) => name.toLowerCase()));
    } catch {
      return new Set<string>();
    }
  }
}

import fs from 'fs';
import Module from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * A plugin reaches the framework through the SDK, and only through the SDK.
 *
 * The build already refuses a framework-internal import (`BuildToolchain.denyFrameworkInternals`), but
 * nothing held at RUN time: the project's `node_modules` is on the resolution path of every process
 * that loads a plugin, so a package that skipped the build — an upload, a hand-edited bundle — could
 * `require('@fromcode119/core')` and, inside the api, hold the api itself. Every built plugin imports
 * `@fromcode119/sdk` (and its subpaths) and nothing else of ours, so that is the whole allowance.
 *
 * Judged by WHO imports, not by what: the SDK's own files load the framework as they always have; only
 * a module whose file lies inside a guarded plugin root is held to the boundary. It covers `require`
 * and `import` alike (`module.registerHooks`), and a path that walks into the framework's packages by
 * file (`../../packages/core/…`) is refused the same as a package name.
 */
export class PluginImportBoundary {
  static readonly ALLOWED = /^@fromcode119\/sdk(\/.*)?$/;
  static readonly SCOPE = '@fromcode119/';

  private static readonly roots = new Set<string>();
  private static frameworkPackages: string | null = null;
  private static installed = false;

  /** Holds every module under `pluginRoot` to the boundary. `projectRoot` locates the framework's packages. */
  static guard(pluginRoot: string, projectRoot: string): void {
    PluginImportBoundary.roots.add(PluginImportBoundary.real(pluginRoot));
    PluginImportBoundary.frameworkPackages = PluginImportBoundary.real(path.resolve(projectRoot, 'packages'));
    PluginImportBoundary.install();
  }

  /** Why `specifier` imported from `parentFile` (resolved to `resolvedFile`) is refused, or null. */
  static refusal(specifier: string, parentFile: string | null, resolvedFile: string | null): string | null {
    if (!parentFile || !PluginImportBoundary.inGuardedRoot(parentFile)) return null;
    if (specifier.startsWith(PluginImportBoundary.SCOPE)) {
      return PluginImportBoundary.ALLOWED.test(specifier) ? null : `"${specifier}" is the framework's internals; a plugin imports @fromcode119/sdk`;
    }
    const packages = PluginImportBoundary.frameworkPackages;
    if (!resolvedFile || !packages || PluginImportBoundary.inGuardedRoot(resolvedFile)) return null;
    const file = PluginImportBoundary.real(resolvedFile);
    if (!file.startsWith(packages + path.sep)) return null;
    return file.startsWith(path.join(packages, 'sdk') + path.sep) ? null : `"${specifier}" reaches the framework's packages by path; a plugin imports @fromcode119/sdk`;
  }

  /** Resolution answers with REAL paths (symlinks followed), so every side of a comparison is one. */
  private static real(file: string): string {
    try { return fs.realpathSync(file); } catch { return path.resolve(file); }
  }

  private static inGuardedRoot(file: string): boolean {
    const resolved = PluginImportBoundary.real(file);
    for (const root of PluginImportBoundary.roots) {
      if (resolved === root || resolved.startsWith(root + path.sep)) return true;
    }
    return false;
  }

  private static install(): void {
    if (PluginImportBoundary.installed) return;
    PluginImportBoundary.installed = true;
    (Module as any).registerHooks({
      resolve: (specifier: string, context: { parentURL?: string }, nextResolve: (specifier: string, context: unknown) => { url: string }) => {
        const parentFile = PluginImportBoundary.toFile(context?.parentURL);
        const early = PluginImportBoundary.refusal(specifier, parentFile, null);
        if (early) PluginImportBoundary.refuse(early, parentFile);
        const result = nextResolve(specifier, context);
        const late = PluginImportBoundary.refusal(specifier, parentFile, PluginImportBoundary.toFile(result?.url));
        if (late) PluginImportBoundary.refuse(late, parentFile);
        return result;
      },
    });
  }

  private static toFile(url: string | undefined): string | null {
    if (!url) return null;
    if (!url.startsWith('file:')) return path.isAbsolute(url) ? url : null;
    try { return fileURLToPath(url); } catch { return null; }
  }

  private static refuse(why: string, parentFile: string | null): never {
    throw Object.assign(new Error(`Security Violation: ${parentFile ?? 'a plugin'} cannot import it — ${why}.`), { code: 'plugin_framework_import_denied' });
  }
}

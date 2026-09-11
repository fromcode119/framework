import { ModuleLocation } from '@extension-builder/module-location';
import { createRequire } from 'node:module';

/**
 * The framework classes this builder borrows, loaded the one way that cannot be mis-analysed.
 *
 * `@fromcode119/core` is CommonJS and this package is ESM, so `import { X } from '@fromcode119/core'`
 * relies on Node's cjs-module-lexer statically finding X in the compiled barrel. That barrel now
 * re-exports 300+ names and the lexer quietly stopped reporting some of them — `DependencyInstaller`
 * first, then `PluginPackageLayout` — so every build command died at load with "does not provide an
 * export named …" for a symbol `require()` returns perfectly well. The failure moves as the barrel
 * grows, which makes it the worst kind: it is never about the code that broke.
 *
 * `createRequire` loads the module as what it is. One place does that; everything else reads it here.
 */
export class Core {
  private static readonly required = ModuleLocation.require('@fromcode119/core');

  static get PluginPackageLayout(): any {
    return Core.required.PluginPackageLayout;
  }

  static get ThemePackageLayout(): any {
    return Core.required.ThemePackageLayout;
  }

  static get IntegrityService(): any {
    return Core.required.IntegrityService;
  }

  /** The npm-cache rule, shared so the theme compiler and the plugin installer cannot drift. */
  static get NpmCacheDirectory(): any {
    return Core.required.NpmCacheDirectory;
  }

  static get DependencyInstaller(): any {
    return Core.required.DependencyInstaller;
  }
}

import fs from 'fs';
import path from 'path';
import type { IPluginManifest } from '@core/interfaces/plugin-manifest.interface';

/**
 * PluginPackageLayout
 *
 * Where a BUILT plugin package puts its compiled output. This is the build's business, not the
 * operator's, so the framework owns it in one place instead of every plugin restating it.
 *
 * Every first-party manifest used to hand-copy the same four strings — `"main": "index.js"`,
 * `"ui": { "entry": "bundle.js", "frontendEntry": "frontend.js" }`, `"migrations": "dist/migrations"`
 * — 25 times, naming `.js` artifacts in a package whose source is all `.ts`. They were 100% uniform:
 * every plugin with a `dist/migrations` directory declared it and every plugin without one omitted it,
 * so the manifest was only ever echoing the layout back at the framework that defined it.
 *
 * `resolve()` fills those values in from the package on disk. An EXPLICIT manifest value always wins —
 * a third-party plugin with a different layout keeps declaring its own, and that stays a visible,
 * declared value rather than something the framework guesses over.
 *
 * The optional artifacts (UI bundles, migrations) are resolved only when the file/directory actually
 * exists, which also fixes a class of dangling declaration: `snapbilt` declared `entry: bundle.js`
 * while shipping no bundle, so the admin advertised a UI asset that 404s. The SERVER entry is
 * deliberately NOT existence-checked — `PluginPackageValidator` must still be able to reject a
 * source-only archive by finding `index.js` missing.
 */
export class PluginPackageLayout {
  /** The compiled server entry, relative to the package root. */
  static readonly SERVER_ENTRY = 'index.js';

  /** Directory holding the built UI bundles, relative to the package root. */
  static readonly UI_DIR = path.join('src', 'ui');

  /** The admin UI bundle, relative to `UI_DIR`. */
  static readonly UI_ENTRY = 'bundle.js';

  /** The storefront UI bundle, relative to `UI_DIR`. */
  static readonly FRONTEND_ENTRY = 'frontend.js';

  /** Directory holding compiled migrations, relative to the package root. */
  static readonly MIGRATIONS_DIR = path.join('dist', 'migrations');

  /**
   * Fill a manifest's build-output paths in from the package layout, in place.
   *
   * Only ABSENT values are filled; anything the manifest declares is left exactly as declared.
   * Returns the same manifest so callers can chain.
   */
  static resolve(pluginPath: string, manifest: IPluginManifest): IPluginManifest {
    const target = manifest as IPluginManifest & Record<string, unknown>;

    if (!target.main && !target.entry) {
      target.main = PluginPackageLayout.SERVER_ENTRY;
    }

    if (!target.migrations && PluginPackageLayout.hasMigrations(pluginPath)) {
      target.migrations = PluginPackageLayout.MIGRATIONS_DIR;
    }

    const ui = (target.ui && typeof target.ui === 'object' ? target.ui : {}) as Record<string, unknown>;
    const hasAdminBundle = PluginPackageLayout.hasUiAsset(pluginPath, PluginPackageLayout.UI_ENTRY);
    const hasFrontendBundle = PluginPackageLayout.hasUiAsset(pluginPath, PluginPackageLayout.FRONTEND_ENTRY);

    if (!ui.entry && hasAdminBundle) {
      ui.entry = PluginPackageLayout.UI_ENTRY;
    }
    if (!ui.frontendEntry && hasFrontendBundle) {
      ui.frontendEntry = PluginPackageLayout.FRONTEND_ENTRY;
    }

    // A declared entry whose bundle is not in the package would have the admin request a 404 asset.
    if (ui.entry === PluginPackageLayout.UI_ENTRY && !hasAdminBundle) {
      delete ui.entry;
    }
    if (ui.frontendEntry === PluginPackageLayout.FRONTEND_ENTRY && !hasFrontendBundle) {
      delete ui.frontendEntry;
    }

    if (Object.keys(ui).length > 0) {
      target.ui = ui as IPluginManifest['ui'];
    }

    return manifest;
  }

  /** True when the package ships compiled migrations at the conventional location. */
  static hasMigrations(pluginPath: string): boolean {
    const dir = path.resolve(pluginPath, PluginPackageLayout.MIGRATIONS_DIR);
    return fs.existsSync(dir) && fs.statSync(dir).isDirectory();
  }

  /**
   * True when the package ships the named UI bundle.
   *
   * The build writes bundles to `src/ui/` and mirrors them to `ui/`; an installed archive may carry
   * either, so both are accepted.
   */
  static hasUiAsset(pluginPath: string, asset: string): boolean {
    return fs.existsSync(path.resolve(pluginPath, PluginPackageLayout.UI_DIR, asset))
      || fs.existsSync(path.resolve(pluginPath, 'ui', asset));
  }
}

import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { BuildStepResult } from '@extension-builder/build-step-result';
import { PluginStyleMarker } from '@extension-builder/assets/plugin-style-marker';

/**
 * Compiles a plugin's admin utilities into `ui/style.css` with tailwind.
 *
 * Three refusals here are load-bearing, and each exists because of a real failure:
 *  - an UNMARKED existing sheet is hand-written, and destroying it would be hidden by gitignore;
 *  - an EMPTY result is a failure, not a success — a declared, fetched, empty stylesheet hides the
 *    fact that the plugin's utilities never compiled;
 *  - styles are built only when `bundle.js` exists, because only an ADMIN bundle renders inside the
 *    admin; a storefront-only plugin styles itself.
 */
export class PluginStyleCompiler {
  static readonly STEP = 'plugin-style-compiler';

  private static readonly CONFIG = 'packages/sdk/src/tailwind/plugin-ui.config.ts';
  private static readonly INPUT = 'packages/sdk/src/tailwind/plugin-ui.css';

  static compile(uiSourceDir: string, outDir: string, slug: string, toolchainRoot: string): BuildStepResult {
    const binary = path.join(toolchainRoot, 'node_modules', '.bin', 'tailwindcss');
    if (!fs.existsSync(binary)) {
      return BuildStepResult.skipped(PluginStyleCompiler.STEP, `tailwindcss is not installed under ${toolchainRoot}`);
    }
    if (!fs.existsSync(path.join(outDir, 'bundle.js'))) {
      return BuildStepResult.skipped(PluginStyleCompiler.STEP, 'no admin bundle.js — a storefront-only plugin styles itself');
    }

    const out = path.join(outDir, 'style.css');
    if (fs.existsSync(out) && !PluginStyleMarker.isGenerated(fs.readFileSync(out, 'utf8'))) {
      return BuildStepResult.failure(
        PluginStyleCompiler.STEP,
        `${slug}: ui/style.css is hand-written, refusing to overwrite. Rename it (e.g. src/ui/${slug}-custom.css) and import it from a component instead.`,
      );
    }

    const temporary = path.join(outDir, '.style.css.building');
    const result = spawnSync(binary, ['-c', PluginStyleCompiler.CONFIG, '-i', PluginStyleCompiler.INPUT, '-o', temporary, '--minify'], {
      cwd: toolchainRoot,
      env: { ...process.env, PLUGIN_UI_DIR: uiSourceDir },
    });

    if (result.status !== 0) {
      fs.rmSync(temporary, { force: true });
      return BuildStepResult.failure(PluginStyleCompiler.STEP, `${slug}: tailwind exited ${String(result.status)}`);
    }
    if (!fs.existsSync(temporary) || fs.statSync(temporary).size === 0) {
      fs.rmSync(temporary, { force: true });
      return BuildStepResult.failure(PluginStyleCompiler.STEP, `${slug}: compiled empty`);
    }

    // Marker first, then the minified output — written AFTER minification so nothing can strip it.
    fs.writeFileSync(out, `${PluginStyleMarker.CURRENT}\n${fs.readFileSync(temporary, 'utf8')}`);
    fs.rmSync(temporary, { force: true });
    return BuildStepResult.ok(PluginStyleCompiler.STEP);
  }
}

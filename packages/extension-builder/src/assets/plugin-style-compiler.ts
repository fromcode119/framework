import { Core } from '@extension-builder/core-bridge';
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { BuildStepResult } from '@extension-builder/build-step-result';
import { PluginStyleMarker } from '@extension-builder/assets/plugin-style-marker';
import { ViteConfigGlue } from '@extension-builder/deps/vite-config-glue';

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

  /** The last meaningful line of tailwind's output — the line that says what went wrong. */
  private static reasonFrom(result: { stderr?: string; stdout?: string }): string {
    const output = `${String(result?.stderr || '')}\n${String(result?.stdout || '')}`;
    const line = output.split('\n').map((entry) => entry.trim()).filter((entry) => entry !== '').pop();
    return line ? ` — ${line}` : '';
  }

  private static readonly CONFIG = 'packages/sdk/src/tailwind/plugin-ui.config.ts';
  private static readonly INPUT = 'packages/sdk/src/tailwind/plugin-ui.css';

  static compile(uiSourceDir: string, outDir: string, slug: string, toolchainRoot: string | null): BuildStepResult {
    if (!toolchainRoot) {
      return BuildStepResult.skipped(PluginStyleCompiler.STEP, "tailwindcss is not installed on any root above this extension");
    }
    const binary = path.join(toolchainRoot, 'node_modules', '.bin', 'tailwindcss');
    if (!fs.existsSync(binary)) {
      return BuildStepResult.skipped(PluginStyleCompiler.STEP, `tailwindcss is not installed under ${toolchainRoot}`);
    }
    if (!fs.existsSync(path.join(outDir, Core.PluginPackageLayout.UI_ENTRY))) {
      return BuildStepResult.skipped(PluginStyleCompiler.STEP, 'no admin bundle.js — a storefront-only plugin styles itself');
    }

    const out = path.join(outDir, Core.PluginPackageLayout.UI_STYLESHEET);
    if (fs.existsSync(out) && !PluginStyleMarker.isGenerated(fs.readFileSync(out, 'utf8'))) {
      return BuildStepResult.failure(
        PluginStyleCompiler.STEP,
        `${slug}: ui/style.css is hand-written, refusing to overwrite. Rename it (e.g. src/ui/${slug}-custom.css) and import it from a component instead.`,
      );
    }

    const temporary = path.join(outDir, '.style.css.building');
    const config = ViteConfigGlue.generatedPath(PluginStyleCompiler.CONFIG);

    /*
     * Say WHY the config is missing, here, rather than letting tailwind report its own version of it.
     * `ViteConfigGlue` collects generation failures for exactly this moment, and nothing read them —
     * so a build that failed because the entry could not be generated announced itself as
     * "tailwind exited 9 — Specified config file does not exist", which points at tailwind and at a
     * path, neither of which is the cause.
     */
    if (!fs.existsSync(config)) {
      const why = ViteConfigGlue.failures.length
        ? ViteConfigGlue.failures.join('; ')
        : 'the generator did not run, or a concurrent build removed it';
      return BuildStepResult.failure(
        PluginStyleCompiler.STEP,
        `${slug}: the tailwind config was never generated at ${config} — ${why}`,
      );
    }
    const result = spawnSync(binary, ['-c', config, '-i', PluginStyleCompiler.INPUT, '-o', temporary, '--minify'], {
      cwd: toolchainRoot,
      encoding: 'utf8',
      env: { ...process.env, PLUGIN_UI_DIR: uiSourceDir },
    });

    if (result.status !== 0) {
      fs.rmSync(temporary, { force: true });
      /**
       * Tailwind's own words, not just its exit code. "tailwind exited 9" is a number nobody can act
       * on: the reason — a config it cannot find, a path it cannot read — was captured by spawnSync
       * and thrown away, so the one useful thing about the failure never reached the screen.
       */
      return BuildStepResult.failure(
        PluginStyleCompiler.STEP,
        `${slug}: tailwind exited ${String(result.status)}${PluginStyleCompiler.reasonFrom(result)}`,
      );
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

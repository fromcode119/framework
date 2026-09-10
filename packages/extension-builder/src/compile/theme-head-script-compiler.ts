import * as fs from 'fs';
import * as path from 'path';
import { ThemePackageLayout } from '@fromcode119/core/client';
import { BuildStepResult } from '@extension-builder/build-step-result';
import { BuildToolchain } from '@extension-builder/deps/build-toolchain';

/**
 * Compiles a theme's head script: `src/boot/head.ts` -> `ui/head.js`.
 *
 * This is the one way to run theme JavaScript BEFORE the storefront bundle chain, which on a
 * cache-disabled deployment lands about six seconds after first paint. The framework inlines the
 * artifact into `<head>`, the same way it already inlines `ui.css`.
 *
 * It is derived, never declared: both names come from `ThemePackageLayout`, so the mapping has
 * exactly one owner. `build-plugins.sh` had to GREP those constants out of the core source file;
 * importing the class is what that class exists for.
 *
 * Why this file exists at all: build-server never compiled the head script, so every theme
 * published through it shipped without one. The framework fetches `ui/head.js`, 404s, inlines
 * nothing and caches that for an hour — the theme's first-paint JavaScript silently never runs.
 */
export class ThemeHeadScriptCompiler {
  static readonly STEP = 'theme-head-script-compiler';

  static async compile(themeDir: string): Promise<BuildStepResult> {
    const source = path.join(themeDir, ThemePackageLayout.HEAD_SCRIPT_SOURCE);
    if (!fs.existsSync(source)) {
      return BuildStepResult.skipped(ThemeHeadScriptCompiler.STEP, `no ${ThemePackageLayout.HEAD_SCRIPT_SOURCE}`);
    }

    const outfile = path.join(themeDir, 'ui', ThemePackageLayout.HEAD_SCRIPT_ARTIFACT);
    fs.mkdirSync(path.dirname(outfile), { recursive: true });

    try {
      const esbuild = new BuildToolchain().loadEsbuild();
      await esbuild.build({
        entryPoints: [source],
        // `--bundle` is what makes "no imports" a BUILD guarantee rather than a rule the theme
        // author has to remember. The source may be any number of classes across any number of
        // files; anything the SHIPPED file imported would put it back behind the very chain this
        // script exists to escape.
        bundle: true,
        format: 'iife',
        target: 'es2018',
        alias: { '@theme': path.join(themeDir, 'src') },
        outfile,
        logLevel: 'warning',
      });
    } catch (error) {
      return BuildStepResult.failure(ThemeHeadScriptCompiler.STEP, String(error));
    }

    return BuildStepResult.ok(ThemeHeadScriptCompiler.STEP);
  }
}

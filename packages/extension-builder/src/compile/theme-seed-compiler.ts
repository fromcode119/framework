import { Core } from '@extension-builder/core-bridge';
import * as fs from 'fs';
import * as path from 'path';
import { BuildStepResult } from '@extension-builder/build-step-result';
import { BuildToolchain } from '@extension-builder/deps/build-toolchain';

/**
 * Bundles a theme's seed: `src/seed.ts` -> a `seed.mjs` under the build output.
 *
 * build-server only ever ARCHIVED a `seed.mjs`; nothing built one, so a theme published through it
 * shipped whatever stale copy happened to sit on disk — or none.
 *
 * Seeds are INITIAL data only: they populate a site the first time a theme is installed and never
 * run again, so a seed that silently fails to build is invisible until someone installs the theme
 * on a fresh site and finds it empty.
 */
export class ThemeSeedCompiler {
  static readonly STEP = 'theme-seed-compiler';

  static async compile(themeDir: string, outputPath: string): Promise<BuildStepResult> {
    return ThemeSeedCompiler.compileEntry(themeDir, Core.ThemePackageLayout.SEED_SOURCE, outputPath, ThemeSeedCompiler.STEP);
  }

  /** The theme's page-contract overrides, built with the same options as the seed. */
  static async compileOverrides(themeDir: string, outputPath: string): Promise<BuildStepResult> {
    return ThemeSeedCompiler.compileEntry(
      themeDir, Core.ThemePackageLayout.PAGE_CONTRACT_OVERRIDES_SOURCE, outputPath, ThemeSeedCompiler.OVERRIDES_STEP,
    );
  }

  static readonly OVERRIDES_STEP = 'theme-page-contract-overrides-compiler';

  private static async compileEntry(themeDir: string, source: string, outputPath: string, step: string): Promise<BuildStepResult> {
    // Sweep any copy an earlier build left in the SOURCE tree. `clean_pack_directory` deliberately
    // spares `seed.mjs`, so a stale one here would be packaged in preference to the fresh build.
    for (const stale of [Core.ThemePackageLayout.SEED_ARTIFACT, 'seed.cjs']) {
      fs.rmSync(path.join(themeDir, stale), { force: true });
    }

    const entry = path.join(themeDir, source);
    if (!fs.existsSync(entry)) return BuildStepResult.skipped(step, `no ${source}`);

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.rmSync(outputPath, { force: true });

    try {
      const esbuild = new BuildToolchain().loadEsbuild();
      await esbuild.build({
        entryPoints: [entry],
        // Same reason as the backend bundle: esbuild writes module paths RELATIVE TO CWD into the
        // output, so the identical seed built from two different working directories differed. Pin it to the workspace so the artifact does not depend on where the builder
        // was invoked.
        absWorkingDir: path.resolve(path.dirname(path.dirname(themeDir))),
        bundle: true,
        format: 'esm',
        platform: 'node',
        packages: 'external',
        // The seed resolves its own source through `@theme`, like the rest of the theme. esbuild
        // does not read the Vite alias, so it is passed explicitly.
        alias: { '@theme': path.join(themeDir, 'src') },
        outfile: outputPath,
        logLevel: 'warning',
      });
    } catch (error) {
      return BuildStepResult.failure(step, String(error));
    }

    return BuildStepResult.ok(step);
  }
}

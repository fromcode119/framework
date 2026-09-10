import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BuildStepResult } from '@extension-builder/build-step-result';
import { ExtensionKind } from '@extension-builder/extension-kind';
import { ExtensionWorkspace } from '@extension-builder/extension-workspace';
import { BuildToolchain } from '@extension-builder/deps/build-toolchain';
import { ViteConfigGlue } from '@extension-builder/deps/vite-config-glue';
import { PluginBackendCompiler } from '@extension-builder/compile/plugin-backend-compiler';
import { PluginMigrationsCompiler } from '@extension-builder/compile/plugin-migrations-compiler';
import { ThemeHeadScriptCompiler } from '@extension-builder/compile/theme-head-script-compiler';
import { ThemeSeedCompiler } from '@extension-builder/compile/theme-seed-compiler';
import { PluginStyleCompiler } from '@extension-builder/assets/plugin-style-compiler';
import { AssetMinifier } from '@extension-builder/assets/asset-minifier';
import { AssetPrecompressor } from '@extension-builder/assets/asset-precompressor';
import { PackCleaner } from '@extension-builder/pack/pack-cleaner';
import { IntegrityStamper } from '@extension-builder/pack/integrity-stamper';
import { ArchiveWriter } from '@extension-builder/pack/archive-writer';

/**
 * The only class that knows the ORDER of a build. Every other class does one step and reports.
 *
 * Two rules hold everywhere here, and both are corrections of how the bash failed:
 *  - it stops at the first failure and names the step, instead of carrying on and exiting 0;
 *  - a step that does nothing states WHY. `build-plugins.sh` wrapped its calls in
 *    `>/dev/null 2>&1 || true`, so when a renamed package made every plugin-UI and theme build
 *    fail, `pack` still exited 0 and shipped a stale `ui/` for a week.
 */
export class ExtensionBuildPipeline {
  static async run(input: {
    sourceDir: string;
    kind: ExtensionKind;
    slug: string;
    pack: boolean;
    packDir?: string;
  }): Promise<BuildStepResult[]> {
    // vite and tailwind load a generated module entry, because their configs are authored as
    // classes. It is build OUTPUT: `check:vite-glue` fails the build if one is left behind, so the
    // whole run is wrapped and `remove()` happens however it ends.
    ViteConfigGlue.generate();
    try {
      return await ExtensionBuildPipeline.runSteps(input);
    } finally {
      ViteConfigGlue.remove();
    }
  }

  private static async runSteps(input: {
    sourceDir: string;
    kind: ExtensionKind;
    slug: string;
    pack: boolean;
    packDir?: string;
  }): Promise<BuildStepResult[]> {
    const workspace = ExtensionWorkspace.resolve(input.sourceDir, input.kind);
    const results: BuildStepResult[] = [];

    const record = (result: BuildStepResult): boolean => {
      results.push(result);
      return !result.failed;
    };

    for (const step of ExtensionBuildPipeline.compileSteps(workspace, input.kind, input.slug)) {
      if (!record(await step())) return results;
    }

    if (!record(AssetMinifier.minify(workspace.uiDir, workspace.toolchainRootFor('terser') ?? BuildToolchain.toolRootFor('terser')))) return results;
    if (!record(AssetPrecompressor.compress(workspace.uiDir))) return results;

    await IntegrityStamper.stampSourceDir(workspace.sourceDir);
    results.push(BuildStepResult.ok(IntegrityStamper.STEP));

    if (!input.pack) return results;

    // Pack in a STAGING copy, never in place. Cleaning strips every `.ts` in the directory, so
    // doing it to `sourceDir` deletes the developer's working tree — which is exactly what an
    // earlier version of this method did, and what `build-plugins.sh` avoided by copying to a
    // temp dir first.
    const packDir = input.packDir ?? fs.mkdtempSync(path.join(os.tmpdir(), `pack-${input.slug}-`));
    if (packDir !== workspace.sourceDir) {
      fs.cpSync(workspace.sourceDir, packDir, { recursive: true });
    }

    PackCleaner.clean(packDir);
    results.push(BuildStepResult.ok('pack-cleaner'));
    await IntegrityStamper.stampPackedDir(packDir);
    results.push(BuildStepResult.ok('integrity-stamper:packed'));

    const version = ExtensionBuildPipeline.readVersion(packDir);
    const outputPath = path.join(
      ExtensionBuildPipeline.distRoot(workspace.sourceDir, input.kind),
      `${input.slug}-${version}.tar.gz`,
    );
    try {
      await new ArchiveWriter().writeTarGz(packDir, outputPath);
      results.push(BuildStepResult.ok(`archive-writer -> ${outputPath}`));
    } catch (error) {
      results.push(BuildStepResult.failure('archive-writer', String(error)));
    }

    return results;
  }

  /** The per-kind steps, as thunks so the loop can stop before running the next one. */
  private static compileSteps(
    workspace: ExtensionWorkspace,
    kind: ExtensionKind,
    slug: string,
  ): Array<() => Promise<BuildStepResult>> {
    if (kind === ExtensionKind.THEME) {
      return [
        () => ThemeHeadScriptCompiler.compile(workspace.sourceDir),
        () => ThemeSeedCompiler.compile(workspace.sourceDir, path.join(workspace.sourceDir, 'build', 'seed.mjs')),
      ];
    }

    if (kind === ExtensionKind.APPEARANCE) {
      return [async () => BuildStepResult.skipped('appearance-compiler', 'appearances build through their own vite config')];
    }

    return [
      () => ExtensionBuildPipeline.compileBackend(workspace, slug),
      () => ExtensionBuildPipeline.compileMigrations(workspace, slug),
      async () => PluginStyleCompiler.compile(workspace.uiSourceDir, workspace.uiDir, slug, ViteConfigGlue.frameworkRoot() ?? BuildToolchain.toolRootFor('tailwindcss')),
    ];
  }

  private static async compileBackend(workspace: ExtensionWorkspace, slug: string): Promise<BuildStepResult> {
    const step = 'plugin-backend-compiler';
    if (!fs.existsSync(path.join(workspace.sourceDir, 'index.ts'))) {
      return BuildStepResult.skipped(step, 'no index.ts');
    }
    try {
      await new PluginBackendCompiler().compileBackend(workspace.sourceDir, slug);
    } catch (error) {
      return BuildStepResult.failure(step, String(error));
    }
    return BuildStepResult.ok(step);
  }

  private static async compileMigrations(workspace: ExtensionWorkspace, slug: string): Promise<BuildStepResult> {
    const step = 'plugin-migrations-compiler';
    if (!fs.existsSync(path.join(workspace.sourceDir, 'migrations'))) {
      return BuildStepResult.skipped(step, 'no migrations/');
    }
    try {
      const manifestPath = path.join(workspace.sourceDir, 'manifest.json');
      const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
      await new PluginMigrationsCompiler().compileMigrations(workspace.sourceDir, manifest);
    } catch (error) {
      return BuildStepResult.failure(step, String(error));
    }
    return BuildStepResult.ok(step);
  }

  private static readVersion(dir: string): string {
    try {
      return String(JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')).version ?? '0.0.0');
    } catch {
      return '0.0.0';
    }
  }

  /** `dist/packages/<kind>s/` beside the workspace, the same place build-plugins.sh wrote to. */
  private static distRoot(sourceDir: string, kind: ExtensionKind): string {
    const workspaceRoot = path.dirname(path.dirname(sourceDir));
    return path.join(workspaceRoot, 'dist', 'packages', kind.directoryName());
  }
}

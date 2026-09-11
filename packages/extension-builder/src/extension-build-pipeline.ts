import { Core } from '@extension-builder/core-bridge';
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
import { PluginUiCompiler } from '@extension-builder/compile/plugin-ui-compiler';
import { ThemeHeadScriptCompiler } from '@extension-builder/compile/theme-head-script-compiler';
import { ThemeSeedCompiler } from '@extension-builder/compile/theme-seed-compiler';
import { ThemeBundleCompiler } from '@extension-builder/compile/theme-bundle-compiler';
import { PluginStyleCompiler } from '@extension-builder/assets/plugin-style-compiler';
import { AssetMinifier } from '@extension-builder/assets/asset-minifier';
import { AssetPrecompressor } from '@extension-builder/assets/asset-precompressor';
import { PackCleaner } from '@extension-builder/pack/pack-cleaner';
import { ThemeSsrDependencyCollector } from '@extension-builder/pack/theme-ssr-dependency-collector';
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

    if (!record(await AssetMinifier.minify(workspace.uiDir, workspace.toolchainRootFor('terser') ?? BuildToolchain.toolRootFor('terser')))) return results;
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

    // BEFORE cleaning: the seed is copied in from dist and theme.json pointed at it, because
    // PackCleaner deliberately spares `seed.mjs` and would otherwise have nothing to spare.
    if (input.kind === ExtensionKind.THEME) {
      results.push(ExtensionBuildPipeline.stageThemeSeed(packDir, ExtensionBuildPipeline.seedOutputPath(workspace, input.slug)));
    }

    PackCleaner.clean(packDir);
    results.push(BuildStepResult.ok('pack-cleaner'));

    // AFTER cleaning, and the order is not a detail: PackCleaner strips `node_modules`, which is
    // precisely where the SSR closure is written. Collecting first would delete it again.
    if (input.kind === ExtensionKind.THEME) {
      const ssr = ThemeSsrDependencyCollector.collect(workspace.sourceDir, packDir);
      results.push(ssr);
      if (ssr.failed) return results;
      // A publicDir misconfiguration once shipped the site's user uploads inside a theme tarball.
      fs.rmSync(path.join(packDir, 'public', 'uploads'), { recursive: true, force: true });
    }
    await IntegrityStamper.stampPackedDir(packDir);
    results.push(BuildStepResult.ok('integrity-stamper:packed'));

    const version = ExtensionBuildPipeline.readVersion(packDir, input.kind);
    // `theme-` prefix for themes, bare slug for plugins — build-plugins.sh's convention, and
    // installers and the marketplace both match on these names.
    const baseName = input.kind === ExtensionKind.THEME ? `theme-${input.slug}` : input.slug;
    const outputPath = path.join(
      ExtensionBuildPipeline.distRoot(workspace.sourceDir, input.kind),
      `${baseName}-${version}.tar.gz`,
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
        () => ExtensionBuildPipeline.compileThemeBundle(workspace, slug),
        () => ThemeHeadScriptCompiler.compile(workspace.sourceDir),
        // The built seed goes to the DIST tree, never back inside the theme: build-plugins.sh
        // writes it to dist/packages/build/themes/<slug>/ for the same reason, and the path matches so, and a `build/` directory
        // left in the source tree would be picked up and packaged.
        () => ThemeSeedCompiler.compile(workspace.sourceDir, ExtensionBuildPipeline.seedOutputPath(workspace, slug)),
      ];
    }

    if (kind === ExtensionKind.APPEARANCE) {
      return [async () => BuildStepResult.skipped('appearance-compiler', 'appearance building is not ported yet — use build-plugins.sh')];
    }

    return [
      () => ExtensionBuildPipeline.compileBackend(workspace, slug),
      () => ExtensionBuildPipeline.compileUi(workspace, slug),
      () => ExtensionBuildPipeline.compileMigrations(workspace, slug),
      async () => PluginStyleCompiler.compile(workspace.uiSourceDir, workspace.uiDir, slug, ViteConfigGlue.frameworkRoot() ?? BuildToolchain.toolRootFor('tailwindcss')),
    ];
  }

  private static async compileBackend(workspace: ExtensionWorkspace, slug: string): Promise<BuildStepResult> {
    const step = 'plugin-backend-compiler';
    if (!fs.existsSync(path.join(workspace.sourceDir, Core.PluginPackageLayout.SERVER_ENTRY_SOURCE))) {
      return BuildStepResult.skipped(step, `no ${Core.PluginPackageLayout.SERVER_ENTRY_SOURCE}`);
    }
    try {
      await new PluginBackendCompiler().compileBackend(workspace.sourceDir, slug);
    } catch (error) {
      return BuildStepResult.failure(step, String(error));
    }
    return BuildStepResult.ok(step);
  }

  private static async compileThemeBundle(workspace: ExtensionWorkspace, slug: string): Promise<BuildStepResult> {
    const step = 'theme-bundle-compiler';
    const compiler = new ThemeBundleCompiler();
    // A theme repo commits NO build output (`ui/` and `ui-ssr/` are gitignored), so without this
    // the archive ships a theme with no bundles at all — and never the ui-ssr/entry.mjs server
    // bundle the frontend needs, which is how a prod page comes to serve an empty body.
    if (!compiler.hasThemeSources(workspace.sourceDir)) {
      return BuildStepResult.skipped(step, 'no theme sources');
    }
    try {
      await compiler.build(workspace.sourceDir, slug);
    } catch (error) {
      return BuildStepResult.failure(step, String(error));
    }
    return BuildStepResult.ok(step);
  }

  private static async compileUi(workspace: ExtensionWorkspace, slug: string): Promise<BuildStepResult> {
    const step = 'plugin-ui-compiler';
    if (!fs.existsSync(workspace.uiSourceDir)) return BuildStepResult.skipped(step, 'no src/ui or ui directory');
    try {
      const manifestPath = path.join(workspace.sourceDir, 'manifest.json');
      const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
      await new PluginUiCompiler().compileUI(workspace.sourceDir, slug, manifest);
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

  /**
   * Copies the built seed into the package and points `theme.json` at it. The theme's own
   * directory never contains a `seed.mjs`; only the artifact does.
   */
  private static stageThemeSeed(packDir: string, builtSeed: string): BuildStepResult {
    const step = 'theme-seed-staging';
    if (!fs.existsSync(builtSeed)) return BuildStepResult.skipped(step, 'no built seed to stage');

    fs.copyFileSync(builtSeed, path.join(packDir, Core.ThemePackageLayout.SEED_ARTIFACT));
    fs.rmSync(path.join(packDir, 'seed.cjs'), { force: true });

    const manifestPath = path.join(packDir, 'theme.json');
    if (!fs.existsSync(manifestPath)) return BuildStepResult.skipped(step, 'no theme.json to point at the seed');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.seeds = Core.ThemePackageLayout.SEED_ARTIFACT;
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    return BuildStepResult.ok(step);
  }

  private static seedOutputPath(workspace: ExtensionWorkspace, slug: string): string {
    const workspaceRoot = path.dirname(path.dirname(workspace.sourceDir));
    return path.join(workspaceRoot, 'dist', 'packages', 'build', 'themes', slug, Core.ThemePackageLayout.SEED_ARTIFACT);
  }

  /** A theme declares itself in `theme.json`; everything else in `manifest.json`. */
  private static readVersion(dir: string, kind: ExtensionKind): string {
    const manifestName = kind === ExtensionKind.THEME ? 'theme.json' : 'manifest.json';
    try {
      return String(JSON.parse(fs.readFileSync(path.join(dir, manifestName), 'utf8')).version ?? '0.0.0');
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

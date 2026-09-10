import { execFile } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';
import { BuildToolchain } from '@extension-builder/deps/build-toolchain';
import { PluginUiViteCompiler } from '@extension-builder/compile/plugin-ui-vite-compiler';
import { PluginPackageLayout } from '@fromcode119/core/client';

/**
 * Compiles a plugin's UI — the vite component build, the storefront and tracker bundles, and the
 * mirroring of built artifacts into the served `ui/` dir.
 *
 * Split out of build-server's `PackageCompiler`, which had grown past the 300-line limit doing
 * backend, UI, migrations and mirroring at once.
 */
export class PluginUiCompiler {
  private static readonly execFileAsync = promisify(execFile);


  /**
   * Served `ui/` artifacts, mirrored UNCONDITIONALLY — same list as build-plugins.sh:344, the reference
   * implementation. `frontend.js` used to be copied only when `manifest.ui.frontendEntry` was declared;
   * the manifest rule made that field framework-derived, so it is absent from every plugin and the
   * storefront bundle was never copied — Vite rebuilt `src/ui/frontend.js` while the build server shipped
   * whatever ancient `ui/frontend.js` sat on disk, beside a perfectly current admin bundle.
   */
  private static readonly FRONTEND_ENTRY = PluginPackageLayout.FRONTEND_ENTRY;

  private static readonly MIRRORED_ARTIFACTS = [
    PluginPackageLayout.UI_ENTRY, `${PluginPackageLayout.UI_ENTRY}.map`, `${PluginPackageLayout.UI_ENTRY}.gz`,
    PluginPackageLayout.FRONTEND_ENTRY, `${PluginPackageLayout.FRONTEND_ENTRY}.map`, `${PluginPackageLayout.FRONTEND_ENTRY}.gz`,
    PluginPackageLayout.TRACKER_ENTRY, `${PluginPackageLayout.TRACKER_ENTRY}.gz`, PluginPackageLayout.UI_STYLESHEET,
  ];

  private toolchain = new BuildToolchain();

  private viteCompiler = new PluginUiViteCompiler();

  /**
   * Compile the plugin's UI entry point → bundle.js
   *
   * Source layout (new): plugins/<slug>/src/ui/index.ts
   * Served location:     plugins/<slug>/ui/bundle.js
   *
   * Falls back to the legacy ui/ layout for older plugin clones.
   * Always mirrors the built artifact to the served ui/ dir afterwards.
   */
  async compileUI(sourceDir: string, slug: string, manifest: Record<string, any>): Promise<void> {
    // Prefer new src/ui/ structure; fall back to legacy ui/ for older clones.
    const srcUiDir = path.join(sourceDir, 'src', 'ui');
    const legacyUiDir = path.join(sourceDir, 'ui');
    const uiDir = fs.existsSync(srcUiDir) ? srcUiDir : legacyUiDir;
    // Framework always serves bundles from the top-level ui/ dir.
    const servedUiDir = legacyUiDir;

    if (!fs.existsSync(uiDir)) return;

    const packageJsonPath = path.join(uiDir, 'package.json');
    if (this.toolchain.hasBuildScript(packageJsonPath)) {
      await this.toolchain.installBuildDependencies(uiDir);
      await PluginUiCompiler.execFileAsync('npm', ['run', 'build'], {
        cwd: uiDir,
        timeout: 120000,
        env: { ...process.env, NODE_ENV: 'production' },
      });
      const esbuild = this.toolchain.loadEsbuild();
      await this.compileFrontendRuntime(sourceDir, uiDir, manifest, [], esbuild);
      await this.mirrorToServedDir(uiDir, servedUiDir, manifest);
      return;
    }

    const entryFile = [PluginPackageLayout.SERVER_ENTRY_SOURCE, PluginPackageLayout.SERVER_ENTRY, 'main.ts', 'main.js']
      .map(f => path.join(uiDir, f))
      .find(p => fs.existsSync(p));

    // No hand-written entry, but components carrying static registration markers: the "plugins are just
    // components" model. Build it with the framework-owned Vite pipeline, exactly as build-plugins.sh
    // does locally — this is the path nearly every plugin uses, and without it their UI never builds.
    if (!entryFile && this.viteCompiler.hasComponents(uiDir)) {
      await this.toolchain.installBuildDependencies(uiDir);
      await this.viteCompiler.build(
        uiDir,
        slug,
        String(manifest?.namespace || ''),
        path.join(sourceDir, 'ui-ssr'),
      );
      await this.compileTracker(sourceDir, uiDir);
      await this.mirrorToServedDir(uiDir, servedUiDir, manifest);
      return;
    }

    if (!entryFile) return;

    await this.toolchain.installDependencies(uiDir);

    const esbuild = this.toolchain.loadEsbuild();

    let extraExternal: string[] = [];
    if (manifest.runtimeModules) {
      extraExternal = Array.isArray(manifest.runtimeModules)
        ? manifest.runtimeModules
        : Object.keys(manifest.runtimeModules);
    }

    await esbuild.build({
      entryPoints: [entryFile],
      bundle: true,
      minify: true,
      sourcemap: true,
      format: 'esm',
      platform: 'browser',
      target: ['es2020'],
      outfile: path.join(uiDir, PluginPackageLayout.UI_ENTRY),
      alias: this.toolchain.selfAlias(sourceDir),
      loader: this.toolchain.browserLoader(),
      jsx: 'transform',
      jsxFactory: 'ReactPrimitives.createElement',
      jsxFragment: 'ReactPrimitives.Fragment',
      banner: { js: BuildToolchain.BROWSER_REQUIRE_SHIM },
      external: this.toolchain.browserExternals(extraExternal),
      logLevel: 'warning',
    });

    await this.compileFrontendRuntime(sourceDir, uiDir, manifest, extraExternal, esbuild);
    // Mirror src/ui/bundle.js → ui/bundle.js so the framework can serve it.
    await this.mirrorToServedDir(uiDir, servedUiDir, manifest);
  }

  /**
   * Copy built artifacts from the source UI dir (src/ui/) to the served UI dir (ui/)
   * when they differ. The framework always serves plugin bundles from ui/.
   */

  /**
   * Copy built artifacts from the source UI dir (src/ui/) to the served UI dir (ui/)
   * when they differ. The framework always serves plugin bundles from ui/.
   */
  async mirrorToServedDir(uiDir: string, servedUiDir: string, manifest: Record<string, any>): Promise<void> {
    if (uiDir === servedUiDir) return;
    fs.mkdirSync(servedUiDir, { recursive: true });
    const candidates = [...PluginUiCompiler.MIRRORED_ARTIFACTS];
    // A third-party plugin with a non-standard layout may still declare its own entry name.
    const frontendEntry = String(manifest?.ui?.frontendEntry || '').trim();
    if (frontendEntry && !candidates.includes(frontendEntry)) candidates.push(frontendEntry);
    for (const fileName of candidates) {
      const src = path.join(uiDir, fileName);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(servedUiDir, fileName));
      }
    }
  }

  /**
   * A plugin may ship a standalone storefront script that is NOT a component and so is invisible to the
   * Vite glob entry — analytics' `tracker.ts` is the case this exists for. Built with esbuild, mirroring
   * the same step in build-plugins.sh.
   */
  private async compileTracker(sourceDir: string, uiDir: string): Promise<void> {
    const trackerSource = path.join(uiDir, PluginPackageLayout.TRACKER_SOURCE);
    if (!fs.existsSync(trackerSource)) return;

    const esbuild = this.toolchain.loadEsbuild();
    await esbuild.build({
      entryPoints: [trackerSource],
      bundle: true,
      minify: true,
      sourcemap: true,
      format: 'esm',
      platform: 'browser',
      target: ['es2020'],
      outfile: path.join(uiDir, PluginPackageLayout.TRACKER_ENTRY),
      alias: this.toolchain.selfAlias(sourceDir),
      loader: this.toolchain.browserLoader(),
      jsx: 'transform',
      jsxFactory: 'ReactPrimitives.createElement',
      jsxFragment: 'ReactPrimitives.Fragment',
      banner: { js: BuildToolchain.BROWSER_REQUIRE_SHIM },
      external: this.toolchain.browserExternals([]),
      logLevel: 'warning',
    });
  }

  private async compileFrontendRuntime(
    sourceDir: string,
    uiDir: string,
    manifest: Record<string, any>,
    extraExternal: string[],
    esbuild: typeof import('esbuild'),
  ): Promise<void> {
    // Defaults to the layout's standard name — gating the BUILD on the (now framework-derived, always
    // absent) manifest field meant this path never compiled a storefront bundle either. Whether one
    // exists is decided by the SOURCE lookup below.
    const frontendEntry = String(manifest?.ui?.frontendEntry || '').trim() || PluginUiCompiler.FRONTEND_ENTRY;

    const parsedEntry = path.parse(frontendEntry);
    const sourceCandidates = [
      path.join(uiDir, `${parsedEntry.name}.ts`),
      path.join(uiDir, `${parsedEntry.name}.tsx`),
      path.join(uiDir, `${parsedEntry.name}.js`),
      path.join(uiDir, `${parsedEntry.name}.jsx`),
    ];
    const sourceFile = sourceCandidates.find((candidate) => fs.existsSync(candidate));
    if (!sourceFile) {
      return;
    }

    await esbuild.build({
      entryPoints: [sourceFile],
      bundle: true,
      minify: true,
      sourcemap: true,
      format: 'esm',
      platform: 'browser',
      target: ['es2020'],
      outfile: path.join(uiDir, frontendEntry),
      alias: this.toolchain.selfAlias(sourceDir),
      loader: this.toolchain.browserLoader(),
      jsx: 'transform',
      jsxFactory: 'ReactPrimitives.createElement',
      jsxFragment: 'ReactPrimitives.Fragment',
      banner: { js: BuildToolchain.BROWSER_REQUIRE_SHIM },
      external: this.toolchain.browserExternals(extraExternal),
      logLevel: 'warning',
    });
  }
}

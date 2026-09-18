import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { PluginPackageLayout } from '@fromcode119/core';
// TYPE-only: erased at compile time, so importing it does not eagerly pull the whole
// extension-builder graph into every CLI invocation — same reasoning as ExtensionBuildCommandService.
import type { BuildStepResult as BuildStepResultType, ExtensionBuildPipeline as ExtensionBuildPipelineType } from '@fromcode119/extension-builder';
import { CliUtils } from '@cli/utils';

/**
 * `atlantis plugin build <slug>` and `atlantis plugin dev <slug>` (which spawns
 * `atlantis plugin build <slug> --watch`).
 *
 * Both used to resolve a hand-authored `<plugin>/ui/index.ts` and run a bespoke esbuild over it, plus
 * a second hand-rolled esbuild over `<plugin>/index.ts` for the backend — the same duplication
 * `PluginBackendCompiler`'s own doc comment calls out ("Mirrors: CLI plugin.ts lines 418-454"). No
 * plugin in this repository has ever shipped `ui/index.ts` — plugin UI SOURCES live in `src/ui/`
 * (`PluginPackageLayout.UI_DIR`) and are built by the "plugins are just components" Vite pipeline, so
 * every real plugin printed the raw i18n key `cli.build.noEntry` and exited 0 having built nothing.
 * That key was declared as `cli.build.no_entry` while the call site asked for the camelCase spelling
 * — the `|| key` fallback in `CliUtils.t` is what let a MISSPELLED key survive undetected instead of
 * throwing, so it just printed the key itself for as long as this command existed.
 *
 * This now drives `ExtensionBuildPipeline` for `ExtensionKind.PLUGIN` — the SAME pipeline
 * `atlantis build plugin <slug>` and the pack/install path already use — so there is now ONE way a
 * plugin is built, and it fails loudly instead of silently. The old `cli.build.noEntry`/`no_ui` keys
 * are deleted rather than repaired: nothing calls them any more, since the pipeline's own
 * `BuildStepResult.skippedReason` (plain strings, matching `atlantis build plugin`'s own reporting)
 * says why a step did nothing — a second, i18n-routed message saying the same thing would be the kind
 * of duplication this codebase's "ONE way to build" rule exists to avoid.
 *
 * In its own class, split out of `commands/plugin-build-command-service.ts` (list/deps-install/test
 * stay there), because build+watch is a program in its own right — the same split #100 made for themes.
 */
export class PluginBuildCommandService {
  /** Debounce for the watcher: an editor save arrives as several events. */
  private static readonly REBUILD_DEBOUNCE_MS = 200;

  /**
   * Build OUTPUT the pipeline writes inside the watched `src/ui`, so a watcher must ignore it —
   * otherwise every rebuild's own output triggers another rebuild and the loop never settles. This is
   * `.plugin-entry.tsx` (generated Vite entry, removed again when the build finishes) plus the bundles
   * `PluginUiCompiler` writes into `src/ui` itself before mirroring them to the served `ui/` dir.
   *
   * A plugin that also declares `manifest.ui.browserEntries` gets extra generated files at build time
   * (`<name>.js`/`.map`/`.gz`, written into this same `src/ui` dir by `PluginUiCompiler`) — those are
   * NOT listed here, because naming one here would hardcode a plugin's own script name into the
   * framework. `excludedArtifacts()` below adds them in, read from the plugin's own manifest.
   */
  private static readonly GENERATED_ARTIFACTS = new Set([
    PluginPackageLayout.GENERATED_UI_ENTRY,
    PluginPackageLayout.UI_ENTRY, `${PluginPackageLayout.UI_ENTRY}.map`, `${PluginPackageLayout.UI_ENTRY}.gz`,
    PluginPackageLayout.FRONTEND_ENTRY, `${PluginPackageLayout.FRONTEND_ENTRY}.map`, `${PluginPackageLayout.FRONTEND_ENTRY}.gz`,
    PluginPackageLayout.UI_STYLESHEET,
  ]);

  /**
   * `GENERATED_ARTIFACTS` plus the outputs of whatever the plugin itself declared in
   * `manifest.ui.browserEntries` — read fresh so a manifest edit that adds/renames an entry takes
   * effect on the next filesystem event without restarting `plugin dev`.
   */
  private static excludedArtifacts(pluginDir: string): Set<string> {
    const excluded = new Set(PluginBuildCommandService.GENERATED_ARTIFACTS);
    try {
      const manifest = fs.readJsonSync(path.join(pluginDir, 'manifest.json'));
      for (const name of PluginPackageLayout.browserEntries(manifest)) {
        excluded.add(`${name}.js`);
        excluded.add(`${name}.js.map`);
        excluded.add(`${name}.js.gz`);
      }
    } catch {
      // No manifest, or unreadable — nothing declared to exclude beyond the fixed set.
    }
    return excluded;
  }

  /**
   * How long AFTER a build finishes its own writes to `manifest.json` (the `integrity-stamper` step)
   * are still treated as that build's own echo rather than a real edit. The stamper's checksum is
   * computed FROM the built bundle, so a genuine source edit changes the checksum too — a plain
   * content-hash guard would see that as "real" content change and rebuild a second time to produce
   * the identical checksum again, before finally settling. Gating on "did a build just write this"
   * instead of "did the content change" avoids that echo outright: an operator's own manifest edit
   * lands outside this window and still triggers a rebuild.
   */
  private static readonly REBUILD_SETTLE_MS = 500;

  /** The plugin's directory, or null once it has reported why it cannot be used. */
  private static resolve(slug: string): string | null {
    const pluginDir = path.join(CliUtils.getPluginsDir(), slug);
    if (!fs.existsSync(pluginDir)) {
      console.error(chalk.red(`Plugin directory not found: ${pluginDir}`));
      return null;
    }
    return pluginDir;
  }

  /**
   * Prints one line per step and sets a non-zero exit code on any failure — the same convention
   * `ExtensionBuildCommandService.reportAndExit` uses for `atlantis build plugin <slug>`, so `plugin
   * build` and `build plugin` fail the same way for the same reason.
   */
  private static report(steps: BuildStepResultType[]): void {
    for (const step of steps) {
      if (step.failed) console.log(chalk.red(`  ✗ ${step.step}${step.message ? `: ${step.message}` : ''}`));
      else if (step.skippedReason) console.log(chalk.gray(`  – ${step.step}: ${step.skippedReason}`));
      else console.log(chalk.green(`  ✓ ${step.step}`));
    }
    if (steps.some((s) => s.failed)) process.exitCode = 1;
  }

  private static async runPipeline(pluginDir: string, slug: string): Promise<BuildStepResultType[]> {
    const { ExtensionBuildPipeline, ExtensionKind } = await import('@fromcode119/extension-builder');
    return ExtensionBuildPipeline.run({ sourceDir: pluginDir, kind: ExtensionKind.PLUGIN, slug, pack: false });
  }

  static async build(slug: string, options: { watch?: boolean } = {}): Promise<void> {
    const pluginDir = PluginBuildCommandService.resolve(slug);
    if (!pluginDir) {
      process.exitCode = 1;
      return;
    }

    if (options.watch) {
      await PluginBuildCommandService.dev(slug, pluginDir);
      return;
    }

    console.log(chalk.blue(CliUtils.t('cli.build.starting', { type: 'plugin', slug })));
    const steps = await PluginBuildCommandService.runPipeline(pluginDir, slug);
    PluginBuildCommandService.report(steps);
    // A SKIPPED step names why (see `BuildStepResult`) and is not a failure — a backend-only plugin
    // has no UI to build, and that is a true, honest report, not this command's original defect
    // (which built nothing while claiming success). Only a real `failed` step exits non-zero, the
    // same rule `atlantis build plugin <slug>` already uses, so the two commands agree.
    if (!steps.some((s) => s.failed)) console.log(chalk.green('Plugin build completed successfully!'));
  }

  private static async dev(slug: string, pluginDir: string): Promise<void> {
    console.log(chalk.blue(`\nStarting plugin development mode: ${chalk.bold(slug)}`));
    console.log(chalk.gray('Watching for changes in:'), path.join(pluginDir, 'src'));

    let rebuildTimer: NodeJS.Timeout | null = null;
    let building = false;
    let rebuildQueued = false;
    // Set the instant a build finishes; `manifest.json`/backend-entry events up to
    // `REBUILD_SETTLE_MS` after that are that build's own echo, not an operator edit.
    let settledAt = 0;

    const rebuild = async (): Promise<void> => {
      if (building) {
        rebuildQueued = true;
        return;
      }
      building = true;
      try {
        const steps = await PluginBuildCommandService.runPipeline(pluginDir, slug);
        PluginBuildCommandService.report(steps);
        if (steps.some((s) => s.failed)) {
          console.log(chalk.red(`✗ Build failed for plugin ${slug}`));
        } else {
          console.log(chalk.green(`✓ Rebuilt plugin ${slug} at ${new Date().toLocaleTimeString()}`));
        }
      } catch (error) {
        console.log(chalk.red(`✗ Build failed: ${error}`));
      } finally {
        building = false;
        settledAt = Date.now() + PluginBuildCommandService.REBUILD_SETTLE_MS;
        if (rebuildQueued) {
          rebuildQueued = false;
          await rebuild();
        }
      }
    };

    const scheduleRebuild = (): void => {
      if (rebuildTimer) clearTimeout(rebuildTimer);
      rebuildTimer = setTimeout(() => { void rebuild(); }, PluginBuildCommandService.REBUILD_DEBOUNCE_MS);
    };

    const onSourceEvent = (_event: string, filename: string | Buffer | null): void => {
      if (filename && PluginBuildCommandService.excludedArtifacts(pluginDir).has(path.basename(String(filename)))) return;
      scheduleRebuild();
    };

    // A build in flight (or just finished) is the only thing that touches `manifest.json`/the
    // backend entry from OUR side; anything the operator types arrives outside that window.
    const onOwnedFileEvent = (): void => {
      if (building || Date.now() < settledAt) return;
      scheduleRebuild();
    };

    await rebuild();

    const watchers: fs.FSWatcher[] = [];
    const srcDir = path.join(pluginDir, 'src');
    if (fs.existsSync(srcDir)) watchers.push(fs.watch(srcDir, { recursive: true }, onSourceEvent));
    const manifestPath = path.join(pluginDir, 'manifest.json');
    if (fs.existsSync(manifestPath)) watchers.push(fs.watch(manifestPath, onOwnedFileEvent));
    const backendEntry = path.join(pluginDir, PluginPackageLayout.SERVER_ENTRY_SOURCE);
    if (fs.existsSync(backendEntry)) watchers.push(fs.watch(backendEntry, onOwnedFileEvent));

    const stop = (): void => {
      watchers.forEach((watcher) => watcher.close());
      if (rebuildTimer) clearTimeout(rebuildTimer);
      process.exit(0);
    };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);

    console.log(chalk.gray('Keep this terminal open, or press Ctrl+C to stop.'));
  }
}

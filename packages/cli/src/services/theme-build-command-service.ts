import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
// TYPE-only: erased at compile time, so importing it does not eagerly pull the whole
// extension-builder graph into every CLI invocation — same reasoning as ExtensionBuildCommandService.
import type { ThemeBundleCompiler as ThemeBundleCompilerType } from '@fromcode119/extension-builder';
import { CliUtils } from '@cli/utils';

/**
 * `atlantis theme build` and `atlantis theme dev`.
 *
 * Both used to resolve a hand-authored `ui/index.ts` and run a bespoke esbuild over it. No theme in
 * this repository has ever shipped that file — all four carry `theme.json` + `src/` — so both commands
 * failed with "Entry file not found" for every real theme. They drive `ThemeBundleCompiler`, the
 * framework's own Vite pipeline, which is the same one `atlantis build theme <slug>` and the pack
 * pipeline use, so there is now ONE way a theme is built.
 *
 * In its own class because `theme.ts` is the command REGISTRY — it declares what exists — and the
 * watch loop below is a program.
 */
export class ThemeBuildCommandService {
  /** Debounce for the watcher: an editor save arrives as several events. */
  private static readonly REBUILD_DEBOUNCE_MS = 120;

  /** The theme's directory, or null once it has reported why it cannot be used. */
  private static async resolve(slug: string): Promise<{ themeDir: string; compiler: ThemeBundleCompilerType } | null> {
    const themeDir = path.join(CliUtils.getProjectRoot(), 'themes', slug);
    if (!fs.existsSync(themeDir)) {
      console.error(chalk.red(`Theme directory not found: ${themeDir}`));
      return null;
    }
    const { ThemeBundleCompiler } = await import('@fromcode119/extension-builder');
    const compiler: ThemeBundleCompilerType = new ThemeBundleCompiler();
    if (!compiler.hasThemeSources(themeDir)) {
      console.error(chalk.red(`Theme "${slug}" has no theme.json or src/ directory — nothing to build: ${themeDir}`));
      return null;
    }
    return { themeDir, compiler };
  }

  static async build(slug: string): Promise<void> {
    try {
      const resolved = await ThemeBuildCommandService.resolve(slug);
      if (!resolved) return;
      console.log(chalk.blue(`\nBuilding theme: ${chalk.bold(slug)}...`));
      await resolved.compiler.build(resolved.themeDir, slug);
      console.log(chalk.green('Theme build completed successfully!'));
    } catch (error) {
      console.error(chalk.red('Error building theme:'), error);
    }
  }

  static async dev(slug: string): Promise<void> {
    try {
      const resolved = await ThemeBuildCommandService.resolve(slug);
      if (!resolved) return;
      const { themeDir, compiler } = resolved;

      console.log(chalk.blue(`\nStarting theme development mode: ${chalk.bold(slug)}`));
      console.log(chalk.gray('Watching for changes in:'), path.join(themeDir, 'src'));

      // ThemeBundleCompiler has no watch mode of its own — it shells out to `vite build`, not
      // `vite dev` (a theme has no dev server of its own; it is server-rendered by the frontend).
      // So this drives the same compiler on a debounced file watcher, exactly as the esbuild watch
      // context it replaces did: same visible behaviour, through the pipeline that actually produces
      // a working bundle.
      let rebuildTimer: NodeJS.Timeout | null = null;
      let building = false;
      let rebuildQueued = false;

      const rebuild = async (): Promise<void> => {
        if (building) {
          rebuildQueued = true;
          return;
        }
        building = true;
        try {
          await compiler.build(themeDir, slug);
          console.log(chalk.green(`✓ Rebuilt theme ${slug} at ${new Date().toLocaleTimeString()}`));
        } catch (error) {
          console.log(chalk.red(`✗ Build failed: ${error}`));
        } finally {
          building = false;
          if (rebuildQueued) {
            rebuildQueued = false;
            await rebuild();
          }
        }
      };

      const scheduleRebuild = (): void => {
        if (rebuildTimer) clearTimeout(rebuildTimer);
        rebuildTimer = setTimeout(() => { void rebuild(); }, ThemeBuildCommandService.REBUILD_DEBOUNCE_MS);
      };

      // The compiler writes into the theme's own `ui/`, so rebuilding on a change there would rebuild
      // for ever.
      const onSourceEvent = (_event: string, filename: string | Buffer | null): void => {
        const name = String(filename ?? '');
        if (name.startsWith('ui/') || name.includes(`${path.sep}ui${path.sep}`)) return;
        scheduleRebuild();
      };

      await rebuild();

      const watcher = fs.watch(path.join(themeDir, 'src'), { recursive: true }, onSourceEvent);
      const themeJsonWatcher = fs.watch(path.join(themeDir, 'theme.json'), scheduleRebuild);

      const stop = (): void => {
        watcher.close();
        themeJsonWatcher.close();
        if (rebuildTimer) clearTimeout(rebuildTimer);
        process.exit(0);
      };
      process.on('SIGINT', stop);
      process.on('SIGTERM', stop);

      console.log(chalk.gray('Keep this terminal open, or press Ctrl+C to stop.'));
    } catch (error) {
      console.error(chalk.red('Error in theme dev mode:'), error);
    }
  }
}

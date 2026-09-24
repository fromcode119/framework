import path from 'node:path';
import { PluginUiTypecheck } from '../plugin-ui-typecheck';
import { ArchorCommand } from './arch-guard-command';
import { GuardScope } from './guard-scope';
import { FrameworkRoot } from './framework-root';
import { GuardTarget } from './guard-target';

/**
 * `arch-guard plugin-ui-types` — real `tsc --noEmit` for every plugin's admin UI.
 *
 * Vite and esbuild strip types without checking them, and a plugin carries no tsconfig, so this
 * surface had no type gate at all. It shipped a dead `this.onGitUrlChange` call that silently broke
 * the Git URL field while every build stayed green.
 *
 * A ratchet, like `app-typecheck`: each plugin has a baseline of pre-existing errors, the build fails
 * when a plugin rises ABOVE its baseline, and a plugin that drops below it is reported so the baseline
 * can be LOWERED. Never raise a baseline to make a build pass — that is how the debt became invisible
 * in the first place.
 *
 *   arch-guard plugin-ui-types                     # error mode (default)
 *   PLUGIN_UI_TYPES_MODE=warn arch-guard …         # report only
 *   arch-guard plugin-ui-types <slug> [<slug>…]    # one or more plugins, with full diagnostics
 */
export class PluginUiTypesCommand extends ArchorCommand {
  readonly summary = 'Real tsc --noEmit for every plugin’s admin UI (Vite/esbuild do NOT check types).';


  /** How many diagnostics to print per plugin before truncating. */
  private static readonly SHOWN = 10;

  run(argv: string[]): number {
    const framework = FrameworkRoot.find();
    const repo = FrameworkRoot.repo();
    const mode = process.env.PLUGIN_UI_TYPES_MODE === 'warn' ? 'warn' : 'error';

    const byName = new Map(PluginUiTypecheck.pluginDirs(repo).map((dir) => [path.basename(dir), dir]));
    const unknown = argv.filter((slug) => !byName.has(slug));
    if (unknown.length) {
      console.error(`[arch-guard] no plugin UI found for: ${unknown.join(', ')}`);
      return 2;
    }
    const selected = PluginUiTypesCommand.select(repo, argv, byName);

    console.log('Plugin UI typecheck (real tsc — Vite/esbuild do NOT check types):');
    let failed = false;
    for (const dir of selected) {
      const found = PluginUiTypecheck.report(framework, dir);
      console.log(`  ${path.basename(dir)}: ${found.length} errors${found.length > GuardTarget.COUNT ? ' — MUST BE 0' : ''}`);
      if (found.length > GuardTarget.COUNT) {
        failed = true;
        console.error(PluginUiTypesCommand.trim(found));
      }
    }

    if (failed && mode === 'error') {
      console.error('\nPlugin UI typecheck FAILED — a plugin UI must typecheck with zero errors.');
      return 1;
    }
    console.log(`\nPlugin UI typecheck ${failed ? 'reported issues' : 'passed'} (mode=${mode}).`);
    return 0;
  }

  /** The first few diagnostics, with a count of what was withheld rather than a silent cut. */
  private static trim(found: string[]): string {
    const shown = found.slice(0, PluginUiTypesCommand.SHOWN);
    const rest = found.length - shown.length;
    return shown.join('\n') + (rest > 0 ? `\n    … and ${rest} more.` : '');
  }

  /**
   * The plugin directories this run checks.
   *
   * Plugins named on the command line are spot-checks under `<repo>/plugins`. A SCOPED run checks the
   * directory it was pointed at — the directory itself, not a same-named plugin under `<repo>/plugins`.
   * It used to take the scope's basename and look it up there, so a scope pointing anywhere else (a
   * git worktree, a second checkout) silently type-checked the MAIN checkout's copy and reported it
   * clean; and a scope whose name matched no plugin (every theme and appearance) fell through to
   * checking every plugin in the tree. An extension with no admin UI has nothing to check.
   */
  private static select(repo: string, argv: string[], byName: Map<string, string>): string[] {
    if (argv.length) return argv.map((slug) => byName.get(slug) as string);
    if (GuardScope.isExtension(repo)) {
      return GuardScope.areas(repo).map((entry) => entry.dir).filter((dir) => PluginUiTypecheck.hasUi(dir));
    }
    return [...byName.values()];
  }
}

import path from 'node:path';
import { PluginUiTypecheck } from '../plugin-ui-typecheck';
import { ArchorCommand } from './arch-guard-command';
import { GuardScope } from './guard-scope';
import { FrameworkRoot } from './framework-root';

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

    const all = PluginUiTypecheck.plugins(repo);
    // A scoped run checks the ONE plugin it was pointed at; argv still names plugins explicitly for a
    // local spot-check, and an unscoped run is every plugin exactly as before.
    const scoped = GuardScope.isExtension(repo)
      ? GuardScope.areas(repo).map((entry) => path.basename(entry.dir)).filter((slug) => all.includes(slug))
      : [];
    const selected = argv.length ? argv : (scoped.length ? scoped : all);
    const unknown = selected.filter((slug) => !all.includes(slug));
    if (unknown.length) {
      console.error(`[arch-guard] no plugin UI found for: ${unknown.join(', ')}`);
      return 2;
    }

    console.log('Plugin UI typecheck (real tsc — Vite/esbuild do NOT check types):');
    let failed = false;
    for (const slug of selected) {
      // The plugin's OWN declared number, from `arch-guard.json` in its repository — the framework
      // holds no per-plugin ledger. Absent means zero, which is what a plugin claiming no debt means.
      const baseline = GuardScope.declaredBaseline(path.join(repo, 'plugins', slug), 'pluginUiTypes');
      const found = PluginUiTypecheck.report(framework, repo, slug);
      console.log(`  ${slug}: ${found.length} errors (baseline ${baseline})`);

      if (found.length > baseline) {
        failed = true;
        console.error(`  ${slug}: ABOVE baseline ${baseline} (+${found.length - baseline} NEW):`);
        console.error(PluginUiTypesCommand.trim(found));
      } else if (found.length < baseline) {
        console.log(`  ${slug}: below baseline — LOWER it to ${found.length}.`);
      } else if (argv.length && found.length) {
        console.log(PluginUiTypesCommand.trim(found));
      }
    }

    if (failed && mode === 'error') {
      console.error('\nPlugin UI typecheck FAILED — you introduced new type errors. Fix them; do not raise the baseline.');
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
}

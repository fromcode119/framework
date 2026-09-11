import { PluginUiTypecheck } from '../plugin-ui-typecheck';
import { ArchorCommand } from './arch-guard-command';
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

  /**
   * Pre-existing debt only — 137 errors across 17 plugins the day the gate was added, every one of
   * them invisible until then. LOWER as it is paid off; never raise to make a build pass. A plugin
   * absent from this map has a baseline of ZERO, which is where a newly added plugin starts and where
   * analytics, astrology, hub, plugin-manager, search, seo and tagiqx already are.
   */
  static readonly BASELINES: Readonly<Record<string, number>> = {
    appointments: 29,
    broadcasts: 1,
    cms: 14,
    ecommerce: 23,
    finance: 3,
    forms: 2,
    licensing: 1,
    lms: 7,
    logistics: 1,
    'logistics-econt': 3,
    mlm: 7,
    numerology: 31,
    privacy: 4,
    'social-proof': 7,
    subscriptions: 1,
    'test-feature': 2,
  };

  /** How many diagnostics to print per plugin before truncating. */
  private static readonly SHOWN = 10;

  run(argv: string[]): number {
    const framework = FrameworkRoot.find();
    const repo = FrameworkRoot.repo();
    const mode = process.env.PLUGIN_UI_TYPES_MODE === 'warn' ? 'warn' : 'error';

    const all = PluginUiTypecheck.plugins(repo);
    const selected = argv.length ? argv : all;
    const unknown = selected.filter((slug) => !all.includes(slug));
    if (unknown.length) {
      console.error(`[arch-guard] no plugin UI found for: ${unknown.join(', ')}`);
      return 2;
    }

    console.log('Plugin UI typecheck (real tsc — Vite/esbuild do NOT check types):');
    let failed = false;
    for (const slug of selected) {
      const baseline = PluginUiTypesCommand.BASELINES[slug] ?? 0;
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

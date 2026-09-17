import { WorkspaceTypecheck } from '../workspace-typecheck';
import { ArchorCommand } from './arch-guard-command';
import { FrameworkRoot } from './framework-root';
import { GuardTarget } from './guard-target';

/**
 * `arch-guard workspace-check` — type-check every authored area (plugins, themes, appearances).
 *
 * Framework packages are already checked by their own `tsc` build; esbuild/Vite/next check nothing.
 *
 *   arch-guard workspace-check                     # report (warn)
 *   TSMI_WORKSPACE_MODE=error arch-guard …        # fail the build on any increase
 */
export class WorkspaceCheckCommand extends ArchorCommand {
  readonly summary = 'Type-check plugins, themes and appearances (ratcheted).';

  /**
   * Highest each area may hold. Lower as they are fixed; never raise.
   *
   * A count taken while any file FAILS TO PARSE is not a real count: a syntax error stops tsc from
   * processing that file's dependents, so their errors vanish and the total looks like an improvement.
   * `plugins` briefly read 110 for exactly that reason (an invalid `export { Class.MEMBER }` in
   * one plugin); the honest figure is 124. Always confirm the workspace BUILDS before lowering.
   *
   * `themes` read "2" only because a JSX syntax error in one theme
   * (`Navbar.THEME_LOGO_URL={...}` as an attribute NAME) aborted that file's parse and hid the other
   * 848. With the syntax repaired and the theme `@theme` alias taught to the checker, this is the first
   * honest count — not a regression.
   */
  /**
   * `plugins` lowered 119 → 118 when the `.types.ts` sweep converted one plugin's duplicated
   * provider-state unions into shared reactor `Enum` classes: the enum's declared type made one
   * previously-invisible mismatch a compile error the conversion then fixed.
   */

  run(argv: string[]): number {
    const framework = FrameworkRoot.find();
    const mode = process.env.TSMI_WORKSPACE_MODE === 'error' ? 'error' : 'warn';
    const detail = argv.includes('--detail');
    // `--only <slug>` narrows the report while fixing one extension; the TOTALS still cover everything,
    // so narrowing can never make a ratchet look green by leaving something out.
    const onlyAt = argv.indexOf('--only');
    const only = onlyAt >= 0 ? argv[onlyAt + 1] : undefined;

    console.log('arch-guard workspace typecheck — esbuild/Vite/next do NOT check types:\n');
    let failed = false;
    for (const { area, total, perSlug } of WorkspaceTypecheck.run(FrameworkRoot.repo(), framework)) {
      for (const { slug, errors, messages } of perSlug) {
        if (!errors) continue;
        console.log(`  ${area}/${slug}: ${errors}`);
        if (!detail || (only && slug !== only)) continue;
        for (const message of messages) console.log(`      ${message}`);
      }
      console.log(`  → ${area}: ${total}${total > GuardTarget.COUNT ? ' — MUST BE 0' : ' — clean'}\n`);
      if (total > GuardTarget.COUNT) failed = true;
    }
    if (failed && mode === 'error') {
      console.error('arch-guard workspace typecheck FAILED — a broken `implements` must never reach runtime.');
      return 1;
    }
    console.log(`arch-guard workspace typecheck ${failed ? 'reported issues' : 'passed'} (mode=${mode}).`);
    return 0;
  }
}

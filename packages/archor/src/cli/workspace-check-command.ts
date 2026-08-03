import { WorkspaceTypecheck } from '../workspace-typecheck';
import { ArchorCommand } from './archor-command';
import { FrameworkRoot } from './framework-root';

/**
 * `archor workspace-check` — type-check every authored area (plugins, themes, appearances).
 *
 * Framework packages are already checked by their own `tsc` build; esbuild/Vite/next check nothing.
 *
 *   archor workspace-check                     # report (warn)
 *   TYPOR_WORKSPACE_MODE=error archor …        # fail the build on any increase
 */
export class WorkspaceCheckCommand extends ArchorCommand {
  readonly summary = 'Type-check plugins, themes and appearances (ratcheted).';

  /**
   * Highest each area may hold. Lower as they are fixed; never raise.
   *
   * A count taken while any file FAILS TO PARSE is not a real count: a syntax error stops tsc from
   * processing that file's dependents, so their errors vanish and the total looks like an improvement.
   * `plugins` briefly read 110 for exactly that reason (an invalid `export { Class.MEMBER }` in
   * numerology); the honest figure is 124. Always confirm the workspace BUILDS before lowering.
   *
   * `themes` read "2" only because a JSX syntax error in vselenskiportal88
   * (`Navbar.THEME_LOGO_URL={...}` as an attribute NAME) aborted that file's parse and hid the other
   * 848. With the syntax repaired and the theme `@theme` alias taught to the checker, this is the first
   * honest count — not a regression.
   */
  static readonly BASELINES: Readonly<Record<string, number>> = { plugins: 119, themes: 19, appearance: 0 };

  run(argv: string[]): number {
    const framework = FrameworkRoot.find();
    const mode = process.env.TYPOR_WORKSPACE_MODE === 'error' ? 'error' : 'warn';
    const detail = argv.includes('--detail');
    // `--only <slug>` narrows the report while fixing one extension; the TOTALS still cover everything,
    // so narrowing can never make a ratchet look green by leaving something out.
    const onlyAt = argv.indexOf('--only');
    const only = onlyAt >= 0 ? argv[onlyAt + 1] : undefined;

    console.log('archor workspace typecheck — esbuild/Vite/next do NOT check types:\n');
    let failed = false;
    for (const { area, total, perSlug } of WorkspaceTypecheck.run(FrameworkRoot.repo(), framework)) {
      for (const { slug, errors, messages } of perSlug) {
        if (!errors) continue;
        console.log(`  ${area}/${slug}: ${errors}`);
        if (!detail || (only && slug !== only)) continue;
        for (const message of messages) console.log(`      ${message}`);
      }
      const baseline = WorkspaceCheckCommand.BASELINES[area] ?? 0;
      const verdict = total > baseline ? `ABOVE baseline ${baseline} (+${total - baseline} NEW)`
        : total < baseline ? `below baseline ${baseline} — LOWER it to ${total}`
        : `at baseline ${baseline}`;
      console.log(`  → ${area}: ${total} — ${verdict}\n`);
      if (total > baseline) failed = true;
    }
    if (failed && mode === 'error') {
      console.error('archor workspace typecheck FAILED — a broken `implements` must never reach runtime.');
      return 1;
    }
    console.log(`archor workspace typecheck ${failed ? 'reported issues' : 'passed'} (mode=${mode}).`);
    return 0;
  }
}

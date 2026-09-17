import path from 'node:path';
import { FileSizeGuard } from '../file-size-guard';
import { ArchorCommand } from './arch-guard-command';
import { FrameworkRoot } from './framework-root';
import { GuardScope } from './guard-scope';
import { GuardTarget } from './guard-target';

/**
 * `arch-guard file-size` — the documented `.ts` ≤ 300 / `.tsx` ≤ 200 limits, measured on every root.
 *
 *   arch-guard file-size              # error mode (default) — fails on ANY file over the target
 *   arch-guard file-size --list       # print the oversized files, longest first
 *   FILE_SIZE_MODE=warn arch-guard …  # report only
 */
export class FileSizeCommand extends ArchorCommand {
  readonly summary = 'File-size limits (.ts ≤ 300, .tsx ≤ 200) across framework, plugins, themes and appearances.';


  /**
   * OVER TARGET (`.ts` > 300 / `.tsx` > 200). Pre-existing debt, counted 2026-09-09. LOWER as it is paid
   * off; never raise to make a build pass — a raise is the rule being deleted one number at a time.
   */

  /**
   * UNREADABLE (≥ 400 lines). This is the bucket that has to reach ZERO — it is tracked apart from the
   * target because they are different problems: 320 lines is untidy, 620 cannot be read at all.
   */

  run(argv: string[]): number {
    const framework = FrameworkRoot.find();
    const mode = process.env.FILE_SIZE_MODE === 'warn' ? 'warn' : 'error';
    const list = argv.includes('--list');

    let failed = false;
    console.log(`File size (.ts ≤ ${FileSizeGuard.TS_MAX_LINES}, .tsx ≤ ${FileSizeGuard.TSX_MAX_LINES}):`);

    const repoRoot = FrameworkRoot.repo();
    for (const { area: name, dir } of GuardScope.areas(repoRoot)) {
      const oversized = FileSizeGuard.findOversized(dir);
      const unreadable = oversized.filter((entry) => entry.lines >= FileSizeGuard.UNREADABLE_LINES);
      const count = oversized.length;

      // Reported, never enforced: how many of the "unreadable" files hold 400+ lines of actual CODE.
      // The rest are over the line on COMMENTS, which this codebase deliberately has a lot of.
      const denseCount = unreadable.filter((entry) => entry.codeLines >= FileSizeGuard.UNREADABLE_LINES).length;
      console.log(`  ${name}: ${count} over target`
        + `, of which ${unreadable.length} unreadable ≥${FileSizeGuard.UNREADABLE_LINES}`
        + `${unreadable.length ? ` [${denseCount} by CODE lines]` : ''}`
        + `${count > GuardTarget.COUNT ? ' — MUST BE 0' : ' — clean'}`);

      if (list) {
        // Every offender, not a top-N slice: the target is 0, so a truncated list hides work that
        // still has to be done, and an "unreadable first" view hid the 300-line files entirely.
        for (const entry of oversized) {
          const flag = entry.lines >= FileSizeGuard.UNREADABLE_LINES ? '!' : ' ';
          const dense = entry.codeLines >= FileSizeGuard.UNREADABLE_LINES ? '*' : ' ';
          console.log(`    ${flag} ${String(entry.lines).padStart(5)} raw ${String(entry.codeLines).padStart(5)} code${dense} (max ${entry.limit})  ${path.relative(framework, entry.file)}`);
        }
      }
      if (count > GuardTarget.COUNT) failed = true;
    }

    if (!failed) {
      console.log('File size passed.');
      return 0;
    }
    console.log(`\nA file is past its limit. Split it.`);
    return mode === 'error' ? 1 : 0;
  }
}

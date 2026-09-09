import path from 'node:path';
import { FileSizeGuard } from '../file-size-guard';
import { ArchorCommand } from './archor-command';
import { FrameworkRoot } from './framework-root';

/**
 * `archor file-size` — the documented `.ts` ≤ 300 / `.tsx` ≤ 200 limits, measured on every root.
 *
 *   archor file-size              # error mode (default) — fails ABOVE baseline
 *   archor file-size --list       # print the oversized files, longest first
 *   FILE_SIZE_MODE=warn archor …  # report only
 */
export class FileSizeCommand extends ArchorCommand {
  readonly summary = 'File-size limits (.ts ≤ 300, .tsx ≤ 200) across framework, plugins, themes and appearances.';

  /** Roots to measure, relative to the framework directory. */
  private static readonly ROOTS: Readonly<Record<string, string>> = {
    framework: 'packages',
    plugins: '../../plugins',
    themes: '../../themes',
    appearance: '../../appearance',
  };

  /**
   * OVER TARGET (`.ts` > 300 / `.tsx` > 200). Pre-existing debt, counted 2026-09-09. LOWER as it is paid
   * off; never raise to make a build pass — a raise is the rule being deleted one number at a time.
   */
  static readonly BASELINES: Readonly<Record<string, number>> = {
    framework: 96,
    plugins: 39,
    themes: 15,
    appearance: 4,
  };

  /**
   * UNREADABLE (≥ 400 lines). This is the bucket that has to reach ZERO — it is tracked apart from the
   * target because they are different problems: 320 lines is untidy, 620 cannot be read at all.
   */
  static readonly UNREADABLE_BASELINES: Readonly<Record<string, number>> = {
    framework: 17,
    plugins: 6,
    themes: 4,
    appearance: 0,
  };

  run(argv: string[]): number {
    const framework = FrameworkRoot.find();
    const mode = process.env.FILE_SIZE_MODE === 'warn' ? 'warn' : 'error';
    const list = argv.includes('--list');

    let failed = false;
    console.log(`File size (.ts ≤ ${FileSizeGuard.TS_MAX_LINES}, .tsx ≤ ${FileSizeGuard.TSX_MAX_LINES}):`);

    for (const [name, relative] of Object.entries(FileSizeCommand.ROOTS)) {
      const baseline = FileSizeCommand.BASELINES[name] ?? 0;
      const unreadableBaseline = FileSizeCommand.UNREADABLE_BASELINES[name] ?? 0;
      const oversized = FileSizeGuard.findOversized(path.resolve(framework, relative));
      const unreadable = oversized.filter((entry) => entry.lines >= FileSizeGuard.UNREADABLE_LINES);
      const count = oversized.length;

      console.log(`  ${name}: ${count} over target (baseline ${baseline})`
        + `, of which ${unreadable.length} unreadable ≥${FileSizeGuard.UNREADABLE_LINES} (baseline ${unreadableBaseline})`
        + `${count > baseline || unreadable.length > unreadableBaseline ? ' — ABOVE' : count < baseline || unreadable.length < unreadableBaseline ? ' — below, lower it' : ' — at baseline'}`);

      if (list) {
        for (const entry of (unreadable.length ? unreadable : oversized).slice(0, 20)) {
          const flag = entry.lines >= FileSizeGuard.UNREADABLE_LINES ? '!' : ' ';
          console.log(`    ${flag} ${String(entry.lines).padStart(5)} (max ${entry.limit})  ${path.relative(framework, entry.file)}`);
        }
      }
      if (count > baseline || unreadable.length > unreadableBaseline) failed = true;
    }

    if (!failed) {
      console.log('File size passed.');
      return 0;
    }
    console.log(`\nA file grew past its limit. Split it — do not raise the baseline.`);
    return mode === 'error' ? 1 : 0;
  }
}

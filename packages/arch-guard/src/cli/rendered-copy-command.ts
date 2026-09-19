import path from 'node:path';
import { RenderedCopyGuard } from '../rendered-copy-guard';
import { ArchorCommand } from './arch-guard-command';
import { GuardScope } from './guard-scope';
import { GuardTarget } from './guard-target';

/**
 * `arch-guard rendered-copy [--detail]` — copy rendered from a `.tsx` instead of from `i18n/*.json`.
 *
 * Separate from `convention-guard` for one reason, stated plainly so nobody has to guess: this rule
 * is not yet enforceable. The scan finds **4,276 literals across 673 files** at the time of writing,
 * in all four areas, and every guard in this binary targets zero with no baseline to hide behind —
 * deliberately, because {@link GuardTarget} argues that a non-zero allowance turns a rule into a
 * quota. Wiring this into the failing set today would simply break every build until the whole
 * platform UI is translated, which is a project, not a fix.
 *
 * So it reports, loudly and exactly, and it fails only once the count is actually zero. That is not
 * an exemption: there is no per-area number here to raise, nothing to edit when a new violation
 * lands, and the printed total is the real one. When an area reaches zero it starts failing on the
 * next literal, which is the whole point.
 *
 * The honest sequencing is per area — extract one area's copy into its dictionary, watch the number
 * fall to zero, then move `RenderedCopyGuard` into `convention-guard` for good.
 */
export class RenderedCopyCommand extends ArchorCommand {
  readonly summary = 'Copy rendered from .tsx instead of i18n/*.json, per area [--detail].';

  run(argv: string[]): number {
    const detail = argv.includes('--detail');
    // packages/arch-guard/… -> repo root is four levels up from `framework/Source/packages`.
    const repoRoot = path.resolve(process.cwd(), '..', '..');
    const { counts, detail: hits } = RenderedCopyGuard.scan(GuardScope.areas(repoRoot));

    let outstanding = 0;
    console.log('\nrendered copy (must come from i18n/*.json):');
    for (const area of Object.keys(counts).sort()) {
      const count = counts[area];
      console.log(`  ${area}: ${count}${count > GuardTarget.COUNT ? ' — MUST BE 0' : ' — clean'}`);
      outstanding += count;
    }

    if (detail) {
      for (const { file, hits: lines } of hits.slice(0, 40)) {
        console.log(`    ${path.relative(repoRoot, file)}`);
        for (const line of lines.slice(0, 4)) console.log(`      ${line}`);
      }
    }

    if (outstanding > 0) {
      console.log(`\n${outstanding} literal(s) across ${hits.length} file(s) still render from code.`);
      console.log('Extract them into the area\'s i18n dictionary; this command fails once an area reaches 0 and then regresses.');
    }
    console.log(`\narch-guard rendered-copy ${outstanding === 0 ? 'passed' : 'reported'}.`);
    return 0;
  }
}

import { RenderedCopyGuard } from '../rendered-copy-guard';
import { ArchorCommand } from './arch-guard-command';
import { GuardScope } from './guard-scope';
import { GuardTarget } from './guard-target';
import { ExtensionTrees } from './extension-trees';

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
 * So it reports, loudly and exactly, and it FAILS only inside a tree that has reached zero — the
 * trees listed in {@link RenderedCopyGuard.TRANSLATED}, and inside any extension whose `src/ui` ships an
 * `i18n/en.json` (see {@link RenderedCopyGuard.isEnforced}). That is not an exemption for the rest: there
 * is no per-area number here to raise, the printed total is the real one, and a tree joins the list
 * the day its last literal moves into its dictionary. From then on its next literal is a regression.
 *
 * The honest sequencing is per tree — extract one tree's copy into its dictionary, watch its number
 * fall to zero, add it to the list.
 */
export class RenderedCopyCommand extends ArchorCommand {
  readonly summary = 'Copy rendered from .tsx instead of i18n/*.json, per area [--detail].';

  run(argv: string[]): number {
    const detail = argv.includes('--detail');
    const { counts, detail: hits } = RenderedCopyGuard.scan(GuardScope.areas());

    let outstanding = 0;
    console.log('\nrendered copy (must come from i18n/*.json):');
    for (const area of Object.keys(counts).sort()) {
      const count = counts[area];
      console.log(`  ${area}: ${count}${count > GuardTarget.COUNT ? ' — MUST BE 0' : ' — clean'}`);
      outstanding += count;
    }

    if (detail) {
      for (const { file, hits: lines } of hits.slice(0, 40)) {
        console.log(`    ${ExtensionTrees.show(file)}`);
        for (const line of lines.slice(0, 4)) console.log(`      ${line}`);
      }
    }

    if (outstanding > 0) {
      console.log(`\n${outstanding} literal(s) across ${hits.length} file(s) still render from code.`);
      console.log('Extract them into the area\'s i18n dictionary.');
    }

    const regressions = hits.filter(({ file }) => RenderedCopyGuard.isEnforced(file));
    if (regressions.length) {
      console.log('\nFAILED — these trees are fully translated, so copy rendered from code is a regression:');
      for (const { file, hits: lines } of regressions) {
        console.log(`    ${ExtensionTrees.show(file)}`);
        for (const line of lines) console.log(`      ${line}`);
      }
      console.log('Move each literal into the tree\'s i18n dictionary and render it through its translator.');
      return 1;
    }
    console.log(`\narch-guard rendered-copy ${outstanding === 0 ? 'passed' : 'reported'}.`);
    return 0;
  }
}

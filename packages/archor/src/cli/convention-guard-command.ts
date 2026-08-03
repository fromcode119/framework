import path from 'node:path';
import { ClassOnlyGuard } from '../class-only-guard';
import { HardcodedCopyGuard } from '../hardcoded-copy-guard';
import { DeclarationPlacementGuard } from '../declaration-placement-guard';
import { LeakedInterfaceCopyGuard } from '../leaked-interface-copy-guard';
import { TypeofGuard } from '../typeof-guard';
import { ArchorCommand } from './archor-command';

/**
 * `archor convention-guard [--detail]` — two ratcheted conventions the compiler cannot see:
 *
 *  - hardcoded user-facing copy (non-ASCII string literals outside `i18n/` and `seeds/`)
 *  - hand-rolled `typeof x === '<primitive>'` type guards
 *
 * Both are rules the codebase already states; neither had a checker, so each was caught only in review —
 * repeatedly, and always after the code had shipped. Ratcheted per area: the count may fall, never rise.
 */
export class ConventionGuardCommand extends ArchorCommand {
  readonly summary = 'Hardcoded copy + typeof type-guards, ratcheted per area [--detail].';

  private roots(repoRoot: string): { area: string; dir: string }[] {
    return [
      { area: 'plugins', dir: path.join(repoRoot, 'plugins') },
      { area: 'themes', dir: path.join(repoRoot, 'themes') },
      { area: 'appearance', dir: path.join(repoRoot, 'appearance') },
      { area: 'framework', dir: path.join(repoRoot, 'framework', 'Source', 'packages') },
    ];
  }

  run(argv: string[]): number {
    const detail = argv.includes('--detail');
    const strict = process.env.FRAMEWORK_CONVENTION_MODE === 'error';
    // packages/archor/… -> repo root is four levels up from `framework/Source/packages`.
    const repoRoot = path.resolve(process.cwd(), '..', '..');
    const roots = this.roots(repoRoot);

    let failed = false;
    for (const [name, guard] of [['hardcoded copy', HardcodedCopyGuard], ['typeof guards', TypeofGuard], ['leaked interface copy', LeakedInterfaceCopyGuard], ['declaration placement', DeclarationPlacementGuard]] as const) {
      const { counts, detail: hits } = guard.scan(roots);
      console.log(`\n${name}:`);
      for (const area of Object.keys(counts).sort()) {
        const count = counts[area];
        const baseline = guard.BASELINE[area] ?? 0;
        const verdict = count > baseline
          ? `ABOVE baseline ${baseline} (+${count - baseline} NEW)`
          : count < baseline
            ? `below baseline ${baseline} — LOWER it to ${count}`
            : `at baseline ${baseline}`;
        console.log(`  ${area}: ${count} — ${verdict}`);
        if (count > baseline) failed = true;
      }
      if (detail) {
        for (const { file, hits: lines } of hits.slice(0, 40)) {
          console.log(`    ${path.relative(repoRoot, file)}`);
          for (const line of lines.slice(0, 4)) console.log(`      ${line}`);
        }
      }
    }

    // "Only export class, nothing else" — three buckets, each ratcheted per area.
    const classOnly = ClassOnlyGuard.scan(roots);
    for (const bucket of ['inlineUnion', 'typesFile', 'moduleFn'] as const) {
      console.log(`\n${bucket}:`);
      const perArea = classOnly.counts[bucket];
      for (const area of Object.keys(perArea).sort()) {
        const count = perArea[area];
        const baseline = ClassOnlyGuard.BASELINE[bucket][area] ?? 0;
        const verdict = count > baseline
          ? `ABOVE baseline ${baseline} (+${count - baseline} NEW)`
          : count < baseline
            ? `below baseline ${baseline} - LOWER it to ${count}`
            : `at baseline ${baseline}`;
        console.log(`  ${area}: ${count} - ${verdict}`);
        if (count > baseline) failed = true;
      }
    }
    if (detail) {
      for (const { file, counts } of classOnly.detail.slice(0, 30)) {
        const parts = Object.entries(counts).filter(([, n]) => n).map(([k, n]) => `${k}=${n}`).join(' ');
        console.log(`    ${path.relative(repoRoot, file)}  ${parts}`);
      }
    }

    console.log(`\narchor convention-guard ${failed ? 'FAILED' : 'passed'} (mode=${strict ? 'error' : 'warn'}).`);
    if (failed && !strict) {
      console.log('Set FRAMEWORK_CONVENTION_MODE=error to fail the build on a rise.');
    }
    return failed && strict ? 1 : 0;
  }
}

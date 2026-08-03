import { OopGuard } from '../oop-guard';
import { ArchorCommand } from './archor-command';

/**
 * `archor oop-guard` — report (or enforce) the OOP conventions across every area.
 *
 *   archor oop-guard                      # report
 *   FRAMEWORK_OOP_MODE=error archor …     # fail the build on any regression
 *   archor oop-guard --list <bucket>      # print the offenders behind one count
 */
export class OopGuardCommand extends ArchorCommand {
  readonly summary = 'Report or enforce the OOP conventions (ratcheted per area).';

  run(argv: string[]): number {
    const mode = process.env.FRAMEWORK_OOP_MODE === 'error' ? 'error' : 'warn';
    const perPackage = OopGuard.scan();
    const sum = (key: string): number => [...perPackage.values()].reduce((n, b) => n + b[key].length, 0);

    const listAt = argv.indexOf('--list');
    if (listAt !== -1) return OopGuardCommand.list(perPackage, argv[listAt + 1]);

    OopGuardCommand.report(perPackage, sum);
    const overBaseline = OopGuardCommand.ratchets(perPackage);
    const regressed = OopGuard.ZERO_BUCKETS.filter((b) => sum(b) > 0);

    if (regressed.length) {
      console.error(`\nZeroed rules have REGRESSED: ${regressed.map((b) => `${b} (${sum(b)})`).join(', ')}`);
      console.error('These buckets were driven to zero and are enforced. Run --list <bucket> for the offenders.');
    }
    if (overBaseline.length) {
      console.error(`\nViolations ABOVE baseline: ${overBaseline.join(', ')} — run --list violations.`);
    }
    if (mode === 'error' && (overBaseline.length || regressed.length)) {
      console.error('\nFramework OOP check FAILED (mode=error).');
      return 1;
    }
    console.log(`\nFramework OOP check ${mode === 'error' ? 'passed' : 'passed (mode=warn — violations reported, not enforced)'}.`);
    return 0;
  }

  /** `--list <bucket>`: every offender behind one count, as `package<TAB>entry`. */
  private static list(perPackage: Map<string, any>, bucket: string | undefined): number {
    const first = [...perPackage.values()][0];
    const buckets = [...new Set([...perPackage.values()].flatMap((b) => Object.keys(b)))]
      .filter((k) => Array.isArray(first?.[k]));
    if (!bucket || !buckets.includes(bucket)) {
      console.error(`Usage: --list <bucket>\nBuckets: ${buckets.join(', ')}`);
      return 1;
    }
    for (const [pkg, b] of [...perPackage.entries()].sort()) {
      for (const entry of b[bucket]) console.log(`${pkg}\t${entry}`);
    }
    return 0;
  }

  /** The per-package table and the totals beneath it. */
  private static report(perPackage: Map<string, any>, sum: (key: string) => number): void {
    const score = (b: any): number =>
      b.violations.length + b.enumDebt.length + b.ifaceDebt.length + b.exportDebt.length;

    console.log('Framework OOP check — remaining violations per package:');
    for (const [pkg, b] of [...perPackage.entries()].sort((a, c) => score(c[1]) - score(a[1]))) {
      if (!score(b) && !b.warnings.length) continue;
      console.log(`  ${pkg}: ${b.violations.length} viol, ${b.enumDebt.length} enum, ${b.ifaceDebt.length} iface, ` +
        `${b.exportDebt.length} export, ${b.clientDebt.length} use-client, ${b.orphanIface.length} orphan-iface, ` +
        `${b.warnings.length} warn (${b.files} files)`);
    }
    console.log(`Total: ${sum('violations')} violations, ${sum('enumDebt')} enum-debt (unions→Enum), ` +
      `${sum('ifaceDebt')} iface-debt (I-prefix + one-per-file), ${sum('exportDebt')} export-debt (→ class), ` +
      `${sum('clientDebt')} use-client-literal (→ .client. filename), ${sum('orphanIface')} orphan-interface, ` +
      `${sum('warnings')} warnings.`);
    console.log(`       ${sum('defaultExport')} export-default-expr, ` +
      `${sum('topLevel')} module-level const/let, ${sum('typeAlias')} type-alias.`);
    console.log(`       ${sum('propsGeneric')} component <Props,State> generics, ${sum('defaultClass')} export-default-class.`);
    console.log(`       ${sum('moduleDecl')} module-level declarations outside a class, ` +
      `${sum('enumPlacement')} enum file(s) outside an enums/ dir.`);
  }

  /**
   * The three ratcheted buckets, printed per area. Returns the areas that are ABOVE their baseline —
   * a non-empty result is what fails the build in error mode.
   */
  private static ratchets(perPackage: Map<string, any>): string[] {
    const buckets: ReadonlyArray<readonly [string, string, Record<string, number>, string]> = [
      ['violations', 'Violations per area', OopGuard.VIOLATION_BASELINE, ''],
      ['moduleDecl', 'Module-level declarations per area', OopGuard.MODULE_DECL_BASELINE, ' moduleDecl'],
      ['typesFile', '*.types.ts bags per area', OopGuard.TYPES_FILE_BASELINE, ' typesFile'],
    ];
    const overBaseline: string[] = [];

    for (const [key, heading, baselines, label] of buckets) {
      const perArea = new Map(Object.keys(baselines).map((a) => [a, 0]));
      for (const [pkg, b] of perPackage) {
        const area = OopGuard.areaOf(pkg);
        perArea.set(area, (perArea.get(area) ?? 0) + b[key].length);
      }
      console.log(`${heading} (ratcheted — may fall, never rise):`);
      for (const [area, count] of perArea) {
        const baseline = baselines[area];
        const note = count > baseline ? ' ← ABOVE BASELINE' : (count < baseline ? ' ← lower the baseline' : '');
        console.log(`  ${area}: ${count} (baseline ${baseline})${note}`);
        if (count > baseline) overBaseline.push(`${area}${label}: ${count} > ${baseline}`);
      }
    }
    return overBaseline;
  }
}

import { ArchorCommand } from './arch-guard-command';
import { GuardRegistry } from './guard-registry';
import { GuardRun } from './guard-run';

/**
 * `arch-guard ci` — every guard, one pass, one exit code.
 *
 * This exists because ~40 guards existed and NOTHING ran them. They were reachable only as individual
 * npm scripts, fifteen of which `npm run build` chained; the Dockerfile calls the granular build
 * targets instead, so the images built green while four guards were failing. A check nobody runs is
 * indistinguishable from a check that passes, which is how the tree drifted.
 *
 * Two properties make this hard to re-break:
 *
 *  - The set is WALKED, not listed. Every command in {@link GuardRegistry} that declares `runsInCi`
 *    runs here, so a guard added tomorrow is enforced tomorrow, with nobody having to remember a
 *    second place. The codemods opt out — a CI run that rewrites the tree it is checking is worse
 *    than no CI.
 *  - Every guard RUNS even after one fails. Stopping at the first would turn a red build into a
 *    queue: fix one, push, wait, discover the next. One run reports everything at once.
 *
 * The exit code is the whole point: non-zero if ANY guard failed, so a caller that stops on failure
 * stops on any violation rather than on whichever happened to be first.
 */
export class CiCommand extends ArchorCommand {
  readonly summary = 'Run every guard in one pass; non-zero if any fails.';

  /** Not itself a guard, and running it from inside itself would recurse. */
  readonly runsInCi = false;

  run(argv: string[]): number {
    const only = CiCommand.requestedNames(argv);
    const runs = CiCommand.selected(only).map((entry) => GuardRun.execute(entry[0], entry[1]));

    if (!runs.length) {
      console.error(`[arch-guard ci] no guards matched ${only.length ? only.join(', ') : '(all)'}.`);
      return 2;
    }

    return CiCommand.report(runs);
  }

  /** `--only a,b` / `--only a --only b`, for reproducing one guard's CI result locally. */
  private static requestedNames(argv: string[]): string[] {
    const names: string[] = [];
    argv.forEach((arg, index) => {
      if (arg === '--only') names.push(...String(argv[index + 1] ?? '').split(','));
      else if (arg.startsWith('--only=')) names.push(...arg.slice('--only='.length).split(','));
    });
    return names.map((name) => name.trim()).filter(Boolean);
  }

  private static selected(only: string[]): Array<[string, new () => ArchorCommand]> {
    return [...GuardRegistry.COMMANDS].filter(([name, Command]) => {
      if (!new Command().runsInCi) return false;
      return only.length === 0 || only.includes(name);
    });
  }

  /** One aligned table, failures repeated at the end so the reason is the last thing on screen. */
  private static report(runs: GuardRun[]): number {
    const width = Math.max(...runs.map((run) => run.name.length));
    console.log('\narch-guard ci\n');
    for (const run of runs) console.log(`  ${run.status}  ${run.name.padEnd(width)}  ${run.duration}`);

    const failed = runs.filter((run) => !run.passed);
    console.log(`\n${runs.length - failed.length}/${runs.length} guards passed.`);
    if (!failed.length) return 0;

    console.error(`\nFAILED: ${failed.map((run) => run.name).join(', ')}`);
    console.error(`Reproduce one locally with:  arch-guard ci --only ${failed[0]?.name}`);
    return 1;
  }
}

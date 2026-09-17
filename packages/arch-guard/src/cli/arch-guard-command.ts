/**
 * Base for every `arch-guard` subcommand.
 *
 * A command owns ONLY argv parsing and exit-code reporting; the rule itself lives in the guard class
 * beside it (`SdkBoundaryGuard`, `OopGuard`, …). That split is what lets the same guard be called from
 * a test or another tool without going through a process.
 *
 * `run()` RETURNS the exit code rather than calling `process.exit`, so a command is callable in-process
 * and a dispatcher can decide what to do with a non-zero result — which is exactly what `arch-guard ci`
 * does when it runs every guard in one pass.
 */
export abstract class ArchorCommand {
  /** One-line summary shown by `arch-guard --help`. */
  abstract readonly summary: string;

  /**
   * Does `arch-guard ci` run this command?
   *
   * Guards say yes, which is why it is the DEFAULT — a new guard is enforced the moment it exists,
   * rather than being enforced only once somebody remembers to add it to a list. The opt-out is for
   * commands that are not checks at all: the codemods (`component-migration`, `interface-prefix`,
   * `plugin-alias`, `client-view-move`) REWRITE source, and a CI run that edits the tree it is
   * checking is worse than no CI at all.
   */
  readonly runsInCi: boolean = true;

  /**
   * Environment `arch-guard ci` must set for this command, for guards whose strictness is a mode.
   *
   * Several guards default to reporting and only FAIL when their mode says to — that is how a
   * migration ratchets without blocking the tree it is midway through. CI wants the strict end, and
   * declaring it HERE keeps "how strict is this in CI" beside the guard instead of duplicated into a
   * shell line that drifts from it.
   */
  readonly ciEnv: Readonly<Record<string, string>> = {};

  /** Do the work. The returned number IS the process exit code (0 = clean). */
  abstract run(argv: string[]): number;
}

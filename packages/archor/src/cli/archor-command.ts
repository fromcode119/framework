/**
 * Base for every `archor` subcommand.
 *
 * A command owns ONLY argv parsing and exit-code reporting; the rule itself lives in the guard class
 * beside it (`SdkBoundaryGuard`, `OopGuard`, …). That split is what lets the same guard be called from
 * a test or another tool without going through a process.
 *
 * `run()` RETURNS the exit code rather than calling `process.exit`, so a command is callable in-process
 * and a dispatcher can decide what to do with a non-zero result.
 */
export abstract class ArchorCommand {
  /** One-line summary shown by `archor --help`. */
  abstract readonly summary: string;

  /** Do the work. The returned number IS the process exit code (0 = clean). */
  abstract run(argv: string[]): number;
}

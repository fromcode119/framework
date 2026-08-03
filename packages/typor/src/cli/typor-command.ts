/**
 * Base for every `typor` subcommand.
 *
 * A command owns ONLY argv parsing and exit-code reporting; the transform class beside it owns the work.
 * `run()` RETURNS the exit code rather than calling `process.exit`, so a command stays callable
 * in-process. The promise form exists for `esbuild`, whose JS API is async.
 */
export abstract class TyporCommand {
  /** One-line summary shown by `typor --help`. */
  abstract readonly summary: string;

  /** Do the work. The resolved number IS the process exit code (0 = clean). */
  abstract run(argv: string[]): number | Promise<number>;
}

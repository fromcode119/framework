/**
 * Base for every `nextor` subcommand.
 *
 * A command owns ONLY argv parsing and exit-code reporting; the generator/stamper class beside it owns
 * the work. `run()` RETURNS the exit code rather than calling `process.exit`, so a command stays
 * callable in-process.
 *
 * The return type allows a promise because `with-middleware` spawns a child process and cannot know its
 * exit code synchronously; the dispatcher awaits either form.
 */
export abstract class NextorCommand {
  /** One-line summary shown by `nextor --help`. */
  abstract readonly summary: string;

  /** Do the work. The resolved number IS the process exit code (0 = clean). */
  abstract run(argv: string[]): number | Promise<number>;
}

/**
 * The one place a Node entry file is allowed to "run": a class decorator that calls the decorated
 * class's static `main()` when its module loads.
 *
 *   @ProcessEntry.start('plugin-guest')
 *   export class PluginGuestMain { static async main(): Promise<void> { … } }
 *
 * An entry file is therefore a class and nothing else — no trailing `Main.main().catch(…)` block
 * repeated in every one of them. A rejected `main` is reported under the given name and ends the
 * process with exit code 2; a `main` that resolves to a number is a CLI and that number is its exit
 * code; a `main` that resolves to nothing has started something that keeps the event loop alive
 * (a guest serving a channel) and the process simply goes on.
 */
export class ProcessEntry {
  static readonly FAILURE_EXIT_CODE = 2;

  static start(name: string, argv: () => string[] = () => process.argv.slice(2)): (target: { main: (...args: any[]) => unknown }) => void {
    return (target) => {
      Promise.resolve()
        .then(() => target.main(argv()))
        .then((result) => { if (typeof result === 'number') process.exit(result); })
        .catch((error) => {
          console.error(`[${name}] ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
          process.exit(ProcessEntry.FAILURE_EXIT_CODE);
        });
    };
  }
}

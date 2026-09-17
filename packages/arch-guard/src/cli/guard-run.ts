import { ArchorCommand } from './arch-guard-command';

/**
 * One guard's result inside an `arch-guard ci` pass.
 *
 * A class rather than a shape so the formatting each row needs lives with the data, and so a guard
 * that THROWS is still a result: an exception used to be indistinguishable from a crash of the whole
 * run, which would have taken the remaining guards with it. Here it is caught, recorded as a failure,
 * and the pass continues — a guard that cannot run is a guard that did not pass.
 */
export class GuardRun {
  private constructor(
    readonly name: string,
    readonly code: number,
    readonly durationMs: number,
  ) {}

  /**
   * Run one command under the environment it declares for CI, then put the environment back.
   *
   * Restoring matters because every guard shares this process: a mode left set by one would silently
   * change the strictness of another, and a guard whose strictness depends on the order guards ran in
   * is not a guard.
   */
  static execute(name: string, Command: new () => ArchorCommand): GuardRun {
    const command = new Command();
    const restore = GuardRun.applyEnv(command.ciEnv);
    const started = Date.now();
    try {
      return new GuardRun(name, command.run([]), Date.now() - started);
    } catch (error) {
      console.error(`\n[arch-guard ci] ${name} threw:\n${error instanceof Error ? error.stack : String(error)}`);
      return new GuardRun(name, 1, Date.now() - started);
    } finally {
      restore();
    }
  }

  /** Set each declared variable, returning the undo. A variable that was absent is deleted, not blanked. */
  private static applyEnv(env: Readonly<Record<string, string>>): () => void {
    const previous = new Map<string, string | undefined>();
    for (const [key, value] of Object.entries(env)) {
      previous.set(key, process.env[key]);
      process.env[key] = value;
    }
    return () => {
      for (const [key, value] of previous) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    };
  }

  get passed(): boolean {
    return this.code === 0;
  }

  get status(): string {
    return this.passed ? 'PASS' : 'FAIL';
  }

  get duration(): string {
    return this.durationMs >= 1000 ? `${(this.durationMs / 1000).toFixed(1)}s` : `${this.durationMs}ms`;
  }
}

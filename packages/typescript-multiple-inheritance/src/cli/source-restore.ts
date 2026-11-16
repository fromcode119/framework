import os from 'node:os';
import { writeFileSync } from 'node:fs';

/**
 * Holds the ORIGINAL text of every source file a build rewrote in place, and puts it back.
 *
 * Why this is its own class, and not the `finally` it used to be. `typescript-multiple-inheritance build`
 * rewrites extended syntax and package aliases into the sources themselves, runs `tsc`, and restores
 * them afterwards. A `finally` covers a throw and a normal exit — it does NOT run when the process is
 * terminated by a signal: Node's default SIGINT/SIGTERM/SIGHUP handling exits without unwinding, so
 * Ctrl-C, a `kill`, a closed terminal, a stopped agent session or a machine going to sleep mid-build
 * left every rewritten file on disk with its aliases turned into relative paths.
 *
 * That is silent and expensive. On 2026-11-16 an interrupted `npm run build:packages` left 2,697 files
 * rewritten; a `git add -A` carried 9,017 alias imports into a commit, and only the pre-push gate's
 * `imports` guard caught it — after the branch had already spent a CI round and an afternoon.
 *
 * So the restore is registered with the process, runs at most once, and is idempotent: whichever comes
 * first — the build finishing, a throw, or a signal — the tree is left exactly as it was found.
 */
export class SourceRestore {
  /** Signals that end a process without unwinding JavaScript, so a `finally` never sees them. */
  static readonly SIGNALS: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGHUP'];

  private readonly originals = new Map<string, string>();

  private done = false;

  /** Remember a file's text before it is overwritten. The FIRST text wins — that is the original. */
  remember(file: string, source: string): void {
    if (!this.originals.has(file)) this.originals.set(file, source);
  }

  /** How many files are currently rewritten and waiting to be put back. */
  get size(): number {
    return this.originals.size;
  }

  /**
   * Put every remembered file back, once. A file that cannot be written is reported and the rest still
   * go back: one unwritable path must not strand the other 2,696.
   */
  restore(): void {
    if (this.done) return;
    this.done = true;
    for (const [file, source] of this.originals) {
      try {
        writeFileSync(file, source, 'utf8');
      } catch (error) {
        console.error(`[typescript-multiple-inheritance] could not restore ${file}: ${String(error)}`);
      }
    }
  }

  /**
   * Restore on a terminating signal too, then end the process the way the signal would have — exit code
   * 128 + the signal's number, which is what a shell reports for a killed child.
   *
   * Returns a function that removes the handlers again, so a long-lived caller does not accumulate them.
   */
  onSignal(exit: (code: number) => void = (code) => process.exit(code)): () => void {
    const handlers = SourceRestore.SIGNALS.map((signal) => {
      const handler = (): void => {
        this.restore();
        exit(128 + (os.constants.signals[signal] ?? 0));
      };
      process.on(signal, handler);
      return { signal, handler };
    });
    return () => { for (const { signal, handler } of handlers) process.off(signal, handler); };
  }
}

import { execFile } from 'child_process';

/** Runs one program and answers what it printed, or null when it failed. */
export class StackCommand {
  private static readonly TIMEOUT_MS = 60_000;

  static output(file: string, args: readonly string[]): Promise<string | null> {
    return new Promise((resolve) => {
      execFile(file, [...args], { encoding: 'utf8', timeout: StackCommand.TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 }, (error, stdout) => {
        resolve(error ? null : stdout);
      });
    });
  }
}

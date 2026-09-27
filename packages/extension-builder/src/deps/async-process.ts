import { spawn, type SpawnOptions } from 'child_process';

/**
 * Runs a build tool WITHOUT stopping the event loop, and answers what `spawnSync` answered: its exit
 * status and what it printed.
 *
 * The builder runs inside the api (a Sources build, a plugin install), and `spawnSync` there froze the
 * api for the tool's whole run — every site on the platform stopped answering until it finished.
 */
export class AsyncProcess {
  static run(command: string, args: readonly string[], options: SpawnOptions = {}): Promise<{ status: number | null; signal: NodeJS.Signals | null; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      const child = spawn(command, [...args], { ...options, stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      child.stdout?.setEncoding('utf8').on('data', (chunk: string) => { stdout += chunk; });
      child.stderr?.setEncoding('utf8').on('data', (chunk: string) => { stderr += chunk; });
      // A tool that cannot be started at all (not installed) answers with why, as a failed run.
      child.once('error', (error) => resolve({ status: null, signal: null, stdout, stderr: stderr || error.message }));
      child.once('close', (status, signal) => resolve({ status, signal, stdout, stderr }));
    });
  }
}

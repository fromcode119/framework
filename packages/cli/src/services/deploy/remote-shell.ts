import { spawn } from 'child_process';
import { DeploymentTarget } from '@cli/services/deploy/deployment-target';

/**
 * Runs a command on the target host.
 *
 * Every remote call goes through here, so the deploy logic never builds an ssh invocation itself and
 * a `local` target exercises the same code path as a real one. The command reaches the host as a
 * single string for its own shell to parse, which is what lets a caller use a pipeline or a
 * redirect without this class growing an opinion about either.
 */
export class RemoteShell {
  constructor(private readonly target: DeploymentTarget) {}

  /** Output captured; a non-zero exit is returned rather than thrown, for callers that expect one. */
  async run(command: string): Promise<{ code: number; stdout: string; stderr: string }> {
    const [file, args] = this.invocation(command);
    return new Promise((resolve) => {
      const child = spawn(file, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk) => { stdout += String(chunk); });
      child.stderr.on('data', (chunk) => { stderr += String(chunk); });
      child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
    });
  }

  /** Output streamed to this terminal — for the long steps where silence looks like a hang. */
  async stream(command: string): Promise<number> {
    const [file, args] = this.invocation(command);
    return new Promise((resolve) => {
      const child = spawn(file, args, { stdio: ['ignore', 'inherit', 'inherit'] });
      child.on('close', (code) => resolve(code ?? 1));
    });
  }

  async runOrThrow(command: string): Promise<string> {
    const result = await this.run(command);
    if (result.code !== 0) {
      throw new Error(`Command failed on ${this.target.name}: ${command}\n${result.stderr.trim()}`);
    }
    return result.stdout;
  }

  private invocation(command: string): [string, string[]] {
    const scoped = `cd ${this.target.directory} && ${command}`;
    return this.target.isLocal ? ['sh', ['-c', scoped]] : ['ssh', [this.target.host, scoped]];
  }
}

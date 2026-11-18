import fs from 'fs';
import os from 'os';
import path from 'path';
import { StackPlan } from '@cli/services/stack/stack-plan';
import { StackSession } from '@cli/services/stack/stack-session';
import { IStackRecord } from '@cli/services/stack/interfaces/stack-record.interface';

/**
 * The stacks on this machine.
 *
 * Deliberately a directory rather than an index file: the directory IS the record, so a stack
 * cannot be listed after its files are gone, and nothing has to be kept in sync. The metadata that
 * does not belong in `.env` lives beside it in `stack.json`.
 */
export class StackStore {
  /** Chosen above the ports the hand-rolled stacks took (8097, 8101) so neither is disturbed. */
  static readonly FIRST_PORT = 8200;

  constructor(private readonly home: string = os.homedir()) {}

  get root(): string {
    return path.join(this.home, '.fromcode-stacks');
  }

  rootFor(name: string): string {
    return StackPlan.rootFor(name, this.home);
  }

  exists(name: string): boolean {
    return fs.existsSync(this.rootFor(name));
  }

  /** Every stack, oldest first. A directory without a readable `stack.json` is skipped, not fatal. */
  list(): IStackRecord[] {
    if (!fs.existsSync(this.root)) return [];

    return fs
      .readdirSync(this.root)
      .map((name) => this.read(name))
      .filter((record): record is IStackRecord => record !== null)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  read(name: string): IStackRecord | null {
    const root = this.rootFor(name);
    const file = path.join(root, 'stack.json');
    if (!fs.existsSync(file)) return null;

    try {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
      const framework = String(raw.framework || '');
      return {
        name,
        root,
        port: Number(raw.port || 0),
        framework,
        version: String(raw.version || ''),
        createdAt: new Date(String(raw.createdAt || Date.now())),
        // The session is read from the WORKTREE path, which is where the scratchpad id lives; the
        // stack's own directory is outside the scratchpad precisely so it survives a restart.
        session: StackSession.fromWorkingDirectory(framework),
      };
    } catch {
      return null;
    }
  }

  write(name: string, port: number, framework: string, version: string, plugins: readonly string[]): void {
    const root = this.rootFor(name);
    fs.mkdirSync(root, { recursive: true });
    fs.writeFileSync(
      path.join(root, 'stack.json'),
      `${JSON.stringify({ name, port, framework, version, plugins, createdAt: new Date().toISOString() }, null, 2)}\n`,
    );
  }

  /**
   * The lowest free port at or above the first.
   *
   * Only stacks this tool made are consulted. A port another process holds is caught by compose
   * when it tries to publish, which is a clearer failure than this guessing at the whole machine.
   */
  nextPort(): number {
    const taken = new Set(this.list().map((stack) => stack.port));
    let port = StackStore.FIRST_PORT;
    while (taken.has(port)) port += 1;
    return port;
  }

  /** Removes the stack's files. The containers are the caller's job — they go first. */
  forget(name: string): void {
    fs.rmSync(this.rootFor(name), { recursive: true, force: true });
  }
}

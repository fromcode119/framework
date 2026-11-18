import fs from 'fs';
import { spawnSync } from 'child_process';
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

  /** Where a port is claimed, so two sessions starting at once cannot claim the same one. */
  private get portsRoot(): string {
    return path.join(this.root, '.ports');
  }

  /**
   * Claims the lowest free port at or above the first, and returns it.
   *
   * Reading the recorded stacks is not enough on its own. The record is written after the port is
   * chosen, so two sessions running `stack up` in the same second both read the same set, both pick
   * the same number, and the second one dies when compose tries to publish it — after its other ten
   * containers have already started. Several sessions working at once is the normal case here, not
   * an edge one.
   *
   * So the port is claimed by creating a file that cannot be created twice (`wx`), which the
   * filesystem settles rather than this code. A claim left behind by a stack that no longer exists
   * is reclaimed, so a crash does not burn a port forever.
   *
   * The port is also checked for real, because the machine holds more than this tool's stacks —
   * the hand-rolled ones took 8097 and 8101.
   */
  claimPort(name: string, preferred?: number): number {
    fs.mkdirSync(this.portsRoot, { recursive: true });
    const recorded = new Set(this.list().map((stack) => stack.port));

    for (let port = preferred ?? StackStore.FIRST_PORT; port < StackStore.FIRST_PORT + StackStore.PORT_RANGE; port += 1) {
      if (!preferred && recorded.has(port)) continue;
      if (this.claim(port, name)) return port;
      if (preferred) throw new Error(`Port ${port} is already taken.`);
    }
    throw new Error(`No free port between ${StackStore.FIRST_PORT} and ${StackStore.FIRST_PORT + StackStore.PORT_RANGE}.`);
  }

  /** How far above the first port to look before giving up. */
  private static readonly PORT_RANGE = 200;

  /** True when this call is the one that got the port. */
  private claim(port: number, name: string): boolean {
    const lock = path.join(this.portsRoot, String(port));

    if (this.isAbandoned(lock)) fs.rmSync(lock, { force: true });

    try {
      fs.writeFileSync(lock, `${name}\n`, { flag: 'wx' });
    } catch {
      return false;
    }

    // Both of a stack's ports must be free, or it dies on the second one after everything started.
    if (StackStore.inUse(port) || StackStore.inUse(StackPlan.tlsPortFor(port))) {
      fs.rmSync(lock, { force: true });
      return false;
    }
    return true;
  }

  /** Whether anything on this machine is already listening there. */
  private static inUse(port: number): boolean {
    const probe = spawnSync('nc', ['-z', '127.0.0.1', String(port)], { stdio: 'ignore' });
    return probe.status === 0;
  }

  /**
   * A claim whose stack never appeared, long enough ago that it cannot still be starting.
   *
   * The age matters. The port is claimed BEFORE the stack is recorded, so for a moment every live
   * claim looks like one with no stack behind it — and reclaiming on that alone handed the same
   * port to the next caller, which is the collision this was written to prevent. Caught by a test
   * rather than by two sessions.
   */
  private isAbandoned(lock: string): boolean {
    if (!fs.existsSync(lock)) return false;
    if (Date.now() - fs.statSync(lock).mtimeMs < StackStore.CLAIM_GRACE_MS) return false;

    return !this.exists(fs.readFileSync(lock, 'utf8').trim());
  }

  /** How long a claim is trusted before its stack has to exist. Generous: a stack can be slow. */
  private static readonly CLAIM_GRACE_MS = 10 * 60 * 1000;

  /** Gives a stack's ports back. */
  releasePort(port: number): void {
    fs.rmSync(path.join(this.portsRoot, String(port)), { force: true });
  }

  /** Removes the stack's files. The containers are the caller's job — they go first. */
  forget(name: string): void {
    fs.rmSync(this.rootFor(name), { recursive: true, force: true });
  }
}

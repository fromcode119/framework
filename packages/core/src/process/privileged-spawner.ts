import { spawn, type ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import { LineSplitter } from '@core/process/line-splitter';
import { PluginChannel } from '@core/plugin/host/plugin-channel';
import type { IGuestIdentity } from '@core/process/interfaces/guest-identity.interface';
import type { IGuestProcessSpec } from '@core/process/interfaces/guest-process-spec.interface';
import type { IMessagePort } from '@core/process/interfaces/message-port.interface';
import type { ISpawnerPrepared } from '@core/process/interfaces/spawner-prepared.interface';

/**
 * The one process that keeps root after the app gives it up — and does exactly three things with it:
 * makes a guest's directories with the right owners, starts a guest as another user, and kills one.
 *
 * It takes orders from its parent only (the app, over IPC), holds no secrets (empty environment),
 * parses nothing a guest sends (a guest's stdout is forwarded as lines, never interpreted), and exits
 * the moment its parent goes away, taking every guest with it. Everything else — what the guest may
 * call, which tenant it sees — is the host's business on the far side of the guest's socket.
 */
export class PrivilegedSpawner {
  private readonly children = new Map<string, ChildProcess>();
  private readonly channel: PluginChannel;

  constructor(port: IMessagePort, private readonly runtimeDir: string) {
    this.channel = new PluginChannel(port);
    this.channel.serve((type, payload) => this.handle(type, payload));
    this.channel.onNotify((type, payload) => { if (type === 'kill') this.kill(String(payload?.id ?? ''), payload?.signal); });
    port.on('disconnect', () => this.shutdown());
  }

  private async handle(type: string, payload: any): Promise<unknown> {
    switch (type) {
      case 'ping': return 'pong';
      case 'prepare': return this.prepare(payload);
      case 'spawn': return this.spawn(payload);
      default: throw new Error(`spawner: unknown message "${type}"`);
    }
  }

  /**
   * `<runtime>/<id>/host` — owner app, group guest, 0710: the app creates its listening socket here
   * and only the guest can walk in to connect. `<runtime>/<id>/guest` — owner guest, group app,
   * 0710: the mirror image for the guest's own server. Writable dirs become the guest's, 0700.
   */
  private prepare(args: { id: string; identity: IGuestIdentity; appUid: number; appGid: number; writableDirs: string[] }): ISpawnerPrepared {
    const warnings: string[] = [];
    const base = path.join(this.runtimeDir, PrivilegedSpawner.safeId(args.id));
    const hostDir = path.join(base, 'host');
    const guestDir = path.join(base, 'guest');
    fs.mkdirSync(this.runtimeDir, { recursive: true, mode: 0o711 });
    fs.mkdirSync(base, { recursive: true, mode: 0o711 });
    PrivilegedSpawner.own(hostDir, args.appUid, args.identity.gid, 0o710, warnings);
    PrivilegedSpawner.own(guestDir, args.identity.uid, args.appGid, 0o710, warnings);
    for (const dir of args.writableDirs) PrivilegedSpawner.own(dir, args.identity.uid, args.identity.gid, 0o700, warnings);
    return { hostDir, guestDir, warnings };
  }

  private static own(dir: string, uid: number, gid: number, mode: number, warnings: string[]): void {
    fs.mkdirSync(dir, { recursive: true });
    try {
      fs.chownSync(dir, uid, gid);
      fs.chmodSync(dir, mode);
    } catch (error) {
      // A bind mount from a host that refuses ownership changes (Docker Desktop). The directory exists;
      // the guest's user may or may not be able to use it — that is the deployment's fact to know.
      warnings.push(`could not own ${dir} as ${uid}:${gid}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private spawn(args: IGuestProcessSpec & { hostSocket: string }): { pid: number } {
    const id = PrivilegedSpawner.safeId(args.id);
    if (!args.identity) throw new Error(`spawner: guest "${id}" has no identity`);
    // A replaced guest (restart, reload): its predecessor may still be exiting. Kill it and forget it
    // now — its exit notification carries ITS pid, so the host will not mistake it for the new one.
    const previous = this.children.get(id);
    if (previous) {
      this.children.delete(id);
      previous.kill('SIGKILL');
    }
    const child = spawn(process.execPath, [...args.execArgv, args.entryPath, ...args.args, '--fc-host-socket', args.hostSocket], {
      cwd: args.cwd,
      // Nothing from this process: no database URL, no secrets. (Typed loosely because the Next apps augment
      // `ProcessEnv` with required keys; an EMPTY environment is the whole point here.)
      env: {} as NodeJS.ProcessEnv,
      uid: args.identity.uid,
      gid: args.identity.gid,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (!child.pid) throw new Error(`spawner: could not start guest "${id}"`);
    this.children.set(id, child);
    const out = new LineSplitter((line) => this.channel.notify('output', { id, stream: 'stdout', line }));
    const err = new LineSplitter((line) => this.channel.notify('output', { id, stream: 'stderr', line }));
    child.stdout?.on('data', (chunk: Buffer) => out.push(chunk));
    child.stderr?.on('data', (chunk: Buffer) => err.push(chunk));
    child.on('exit', (code, signal) => {
      out.flush();
      err.flush();
      if (this.children.get(id) === child) this.children.delete(id);
      this.channel.notify('exit', { id, pid: child.pid, code, signal });
    });
    child.on('error', (error) => this.channel.notify('output', { id, stream: 'stderr', line: `spawn error: ${error.message}` }));
    return { pid: child.pid };
  }

  private kill(id: string, signal: NodeJS.Signals = 'SIGKILL'): void {
    this.children.get(PrivilegedSpawner.safeId(id))?.kill(signal);
  }

  private shutdown(): void {
    for (const child of this.children.values()) child.kill('SIGKILL');
    process.exit(0);
  }

  /** Ids name directories; one that is not a plain slug is refused rather than sanitised. */
  private static safeId(id: string): string {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,120}$/.test(id)) throw new Error(`spawner: refusing guest id "${id}"`);
    return id;
  }
}

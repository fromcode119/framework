import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { LineSplitter } from '@core/process/line-splitter';
import { SpawnerGuests } from '@core/process/spawner-guests';
import { PluginChannel } from '@core/plugin/host/plugin-channel';
import type { IGuestIdentity } from '@core/process/interfaces/guest-identity.interface';
import type { IGuestProcessSpec } from '@core/process/interfaces/guest-process-spec.interface';
import type { IMessagePort } from '@core/process/interfaces/message-port.interface';
import type { ISpawnerPrepared } from '@core/process/interfaces/spawner-prepared.interface';
import { MessagePortEvent } from '@core/process/enums/message-port-event.enum';
import { GuestOutputStream } from '@core/process/enums/guest-output-stream.enum';
import { SpawnerMessage } from '@core/process/enums/spawner-message.enum';

/**
 * The one process that keeps root after the app gives it up — and does exactly three things with it:
 * makes a guest's directories with the right owners, starts a guest as another user, and kills one.
 *
 * It takes orders from one app only — its parent over IPC, or in the `extension-host` container one
 * api connection — holds no secrets (empty environment), parses nothing a guest sends (a guest's stdout
 * is forwarded as lines, never interpreted), and when that app goes away its guests go with it. As the
 * app's child it then exits too; in `extension-host` it is one of several, and only its own guests go.
 * Everything else — what the guest may call, which tenant it sees — is the host's business on the far
 * side of the guest's socket.
 */
export class PrivilegedSpawner {
  private readonly channel: PluginChannel;

  constructor(
    port: IMessagePort,
    private readonly runtimeDir: string,
    private readonly exitWithApp = true,
    /** Shared by every connection in `extension-host`, so one api can take over another's processes. */
    private readonly guests: SpawnerGuests<PrivilegedSpawner> = new SpawnerGuests<PrivilegedSpawner>(0),
  ) {
    this.channel = new PluginChannel(port);
    this.channel.serve((type, payload) => this.handle(type, payload));
    this.channel.onNotify((type, payload) => { if (type === String(SpawnerMessage.KILL.value)) this.kill(String(payload?.id ?? ''), payload?.signal); });
    port.on(MessagePortEvent.DISCONNECT, () => this.shutdown());
  }

  private async handle(type: string, payload: any): Promise<unknown> {
    switch (type) {
      case String(SpawnerMessage.PING.value): return { pid: process.pid };
      case String(SpawnerMessage.PREPARE.value): return this.prepare(payload);
      case String(SpawnerMessage.SPAWN.value): return this.spawn(payload);
      case String(SpawnerMessage.INVENTORY.value): return this.guests.inventory().map((listing) => ({ ...listing, guestDir: path.join(this.runtimeDir, listing.id, 'guest') }));
      case String(SpawnerMessage.CLAIM.value): return this.guests.claim(PrivilegedSpawner.safeId(String(payload?.id ?? '')), this);
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
    const previous = this.guests.child(id);
    if (previous) {
      this.guests.removeIf(id, previous);
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
    this.guests.add(id, child, this, args.label ?? null);
    // To every api that holds it now — the one that started it, and any that took it over since.
    const tell = (type: string, payload: Record<string, unknown>) => { for (const holder of this.guests.holders(id)) holder.channel.notify(type, payload); };
    const out = new LineSplitter((line) => tell(String(SpawnerMessage.OUTPUT.value), { id, stream: String(GuestOutputStream.STDOUT.value), line }));
    const err = new LineSplitter((line) => tell(String(SpawnerMessage.OUTPUT.value), { id, stream: String(GuestOutputStream.STDERR.value), line }));
    child.stdout?.on('data', (chunk: Buffer) => out.push(chunk));
    child.stderr?.on('data', (chunk: Buffer) => err.push(chunk));
    child.on('exit', (code, signal) => {
      out.flush();
      err.flush();
      const holders = this.guests.holders(id);
      this.guests.removeIf(id, child);
      // Every process of a plugin has its own id (`plugin-<slug>.<n>`), so its sockets' directory is its
      // alone: gone with it, or a plugin replaced a hundred times would leave a hundred behind.
      if (!this.guests.child(id)) fs.rmSync(path.join(this.runtimeDir, id), { recursive: true, force: true });
      for (const holder of holders) holder.channel.notify(String(SpawnerMessage.EXIT.value), { id, pid: child.pid, code, signal });
    });
    child.on('error', (error) => tell(String(SpawnerMessage.OUTPUT.value), { id, stream: String(GuestOutputStream.STDERR.value), line: `spawn error: ${error.message}` }));
    return { pid: child.pid };
  }

  /** Only an api that holds a process may stop it. */
  private kill(id: string, signal: NodeJS.Signals = 'SIGKILL'): void {
    const safe = PrivilegedSpawner.safeId(id);
    if (this.guests.isHeldBy(safe, this)) this.guests.child(safe)?.kill(signal);
  }

  /**
   * The app is gone. As its own child the spawner goes with it, and its processes (nobody else could
   * hold them) at once. In `extension-host` it only lets go: a process another api took over keeps
   * running, and one nobody holds is stopped after the grace (`SpawnerGuests`).
   */
  private shutdown(): void {
    this.guests.release(this);
    if (this.exitWithApp) process.exit(0);
  }

  /** Ids name directories; one that is not a plain slug is refused rather than sanitised. */
  private static safeId(id: string): string {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,120}$/.test(id)) throw new Error(`spawner: refusing guest id "${id}"`);
    return id;
  }
}

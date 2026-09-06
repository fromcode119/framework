import type { ChildProcess } from 'child_process';
import { IpcMessagePort } from '@core/process/ipc-message-port';
import { PluginChannel } from '@core/plugin/host/plugin-channel';
import type { IGuestIdentity } from '@core/process/interfaces/guest-identity.interface';
import type { IGuestProcessSpec } from '@core/process/interfaces/guest-process-spec.interface';
import type { ISpawnerPrepared } from '@core/process/interfaces/spawner-prepared.interface';

/**
 * The app's handle on its privileged spawner: the one root process left after the app dropped its
 * own privileges, and the only way it can still start something as another user.
 *
 * Published on `globalThis` under a well-known symbol rather than a static field: the Next apps
 * bundle core from source while the launcher that forked the spawner runs core from `dist`, so a
 * static would exist twice and be set once. `globalThis` is the single object both copies share.
 */
export class SpawnerClient {
  private static readonly GLOBAL_KEY = Symbol.for('fromcode.privileged-spawner');
  private static readonly REQUEST_TIMEOUT_MS = 30_000;

  private readonly channel: PluginChannel;
  private readonly exitListeners = new Map<string, Set<(code: number | null, signal: string | null, pid: number | null) => void>>();
  private readonly outputListeners = new Map<string, Set<(stream: 'stdout' | 'stderr', line: string) => void>>();

  constructor(private readonly child: ChildProcess) {
    this.channel = new PluginChannel(new IpcMessagePort(child));
    this.channel.onNotify((type, payload) => this.notified(type, payload));
  }

  static current(): SpawnerClient | null {
    return ((globalThis as Record<PropertyKey, unknown>)[SpawnerClient.GLOBAL_KEY] as SpawnerClient | undefined) ?? null;
  }

  static publish(client: SpawnerClient): void {
    (globalThis as Record<PropertyKey, unknown>)[SpawnerClient.GLOBAL_KEY] = client;
  }

  get pid(): number | null {
    return this.child.pid ?? null;
  }

  /** Blocks until the spawner answers, so a failed fork is a startup error rather than a later surprise. */
  ready(): Promise<unknown> {
    return this.channel.request('ping', {}, SpawnerClient.REQUEST_TIMEOUT_MS);
  }

  prepare(args: { id: string; identity: IGuestIdentity; appUid: number; appGid: number; writableDirs: string[] }): Promise<ISpawnerPrepared> {
    return this.channel.request<ISpawnerPrepared>('prepare', args, SpawnerClient.REQUEST_TIMEOUT_MS);
  }

  spawn(spec: IGuestProcessSpec, hostSocket: string): Promise<{ pid: number }> {
    return this.channel.request<{ pid: number }>('spawn', { ...spec, hostSocket }, SpawnerClient.REQUEST_TIMEOUT_MS);
  }

  kill(id: string, signal: NodeJS.Signals): void {
    this.channel.notify('kill', { id, signal });
  }

  /** `pid` names WHICH process of this id exited — a replaced predecessor's exit must not be taken for the current one's. */
  onExit(id: string, listener: (code: number | null, signal: string | null, pid: number | null) => void): void {
    if (!this.exitListeners.has(id)) this.exitListeners.set(id, new Set());
    this.exitListeners.get(id)!.add(listener);
  }

  onOutput(id: string, listener: (stream: 'stdout' | 'stderr', line: string) => void): void {
    if (!this.outputListeners.has(id)) this.outputListeners.set(id, new Set());
    this.outputListeners.get(id)!.add(listener);
  }

  /** A guest is gone for good (killed on purpose): its listeners go with it. */
  forget(id: string): void {
    this.exitListeners.delete(id);
    this.outputListeners.delete(id);
  }

  private notified(type: string, payload: any): void {
    const id = String(payload?.id ?? '');
    if (type === 'exit') {
      for (const listener of this.exitListeners.get(id) ?? []) listener(payload.code ?? null, payload.signal ?? null, payload.pid ?? null);
      return;
    }
    if (type === 'output') {
      for (const listener of this.outputListeners.get(id) ?? []) listener(payload.stream === 'stderr' ? 'stderr' : 'stdout', String(payload.line ?? ''));
    }
  }
}

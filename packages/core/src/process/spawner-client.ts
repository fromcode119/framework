import type { ChildProcess } from 'child_process';
import { IpcMessagePort } from '@core/process/ipc-message-port';
import { SocketMessagePort } from '@core/process/socket-message-port';
import type { IMessagePort } from '@core/process/interfaces/message-port.interface';
import { PluginChannel } from '@core/plugin/host/plugin-channel';
import type { IGuestIdentity } from '@core/process/interfaces/guest-identity.interface';
import type { IGuestProcessSpec } from '@core/process/interfaces/guest-process-spec.interface';
import type { ISpawnerPrepared } from '@core/process/interfaces/spawner-prepared.interface';
import { GuestOutputStream } from '@core/process/enums/guest-output-stream.enum';
import { MessagePortEvent } from '@core/process/enums/message-port-event.enum';

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
  private static readonly UNAVAILABLE_KEY = Symbol.for('fromcode.privileged-spawner.unavailable');
  private static readonly WAITERS_KEY = Symbol.for('fromcode.privileged-spawner.waiters');
  /** The exit reported for every guest when the `extension-host` connection is lost — they went with it. */
  static readonly DISCONNECTED = 'extension-host disconnected';
  /** `PluginProcessHost` values; literal here because process/ must not import plugin/host. */
  static readonly HOSTED_BY_API = 'api';
  static readonly HOSTED_BY_EXTENSION_HOST = 'extension-host';
  private static readonly REQUEST_TIMEOUT_MS = 30_000;

  private readonly channel: PluginChannel;
  private readonly exitListeners = new Map<string, Set<(code: number | null, signal: string | null, pid: number | null) => void>>();
  private readonly outputListeners = new Map<string, Set<(stream: GuestOutputStream, line: string) => void>>();
  private readonly disconnectListeners = new Set<() => void>();

  /** The spawner's pid, learned from its answer to `ping`. */
  private spawnerPid: number | null;

  constructor(
    port: IMessagePort,
    pid: number | null,
    /** Where plugin processes are started: a `PluginProcessHost` value — the api's own container, or `extension-host`. */
    readonly hostedBy: string,
  ) {
    this.spawnerPid = pid;
    this.channel = new PluginChannel(port);
    this.channel.onNotify((type, payload) => this.notified(type, payload));
    port.on(MessagePortEvent.DISCONNECT, () => this.disconnected());
  }

  /** The spawner the api forked as its own child — plugin processes live in the api's container. */
  static fromChild(child: ChildProcess): SpawnerClient {
    return new SpawnerClient(new IpcMessagePort(child), child.pid ?? null, SpawnerClient.HOSTED_BY_API);
  }

  /**
   * The `extension-host` container's spawner, over its socket. It may still be starting when the api
   * does, so this retries until `waitMs`; past that it throws, and the caller says so.
   */
  static async connect(socketPath: string, waitMs: number): Promise<SpawnerClient> {
    const deadline = Date.now() + waitMs;
    for (;;) {
      try {
        const client = new SpawnerClient(await SocketMessagePort.connect(socketPath, 2_000), null, SpawnerClient.HOSTED_BY_EXTENSION_HOST);
        await client.ready();
        return client;
      } catch (error) {
        if (Date.now() >= deadline) throw new Error(`extension-host unreachable at ${socketPath}: ${error instanceof Error ? error.message : String(error)}`);
        await new Promise((resolve) => setTimeout(resolve, 1_000));
      }
    }
  }

  /**
   * The api was configured for an `extension-host` it could not reach. Plugin processes then fail to
   * start WITH this reason — never quietly started somewhere else.
   */
  static publishUnavailable(reason: string | null): void {
    (globalThis as Record<PropertyKey, unknown>)[SpawnerClient.UNAVAILABLE_KEY] = reason ?? undefined;
  }

  static unavailableReason(): string | null {
    return ((globalThis as Record<PropertyKey, unknown>)[SpawnerClient.UNAVAILABLE_KEY] as string | undefined) ?? null;
  }

  static current(): SpawnerClient | null {
    return ((globalThis as Record<PropertyKey, unknown>)[SpawnerClient.GLOBAL_KEY] as SpawnerClient | undefined) ?? null;
  }

  /** `null` withdraws it: the connection to the `extension-host` was lost, and nothing can be started. */
  static publish(client: SpawnerClient | null): void {
    const shared = globalThis as Record<PropertyKey, unknown>;
    shared[SpawnerClient.GLOBAL_KEY] = client ?? undefined;
    if (!client) return;
    const waiters = (shared[SpawnerClient.WAITERS_KEY] as Array<() => void> | undefined) ?? [];
    shared[SpawnerClient.WAITERS_KEY] = [];
    for (const resolve of waiters) resolve();
  }

  /** Resolves once a spawner is published — at once when one already is. */
  static whenAvailable(): Promise<void> {
    if (SpawnerClient.current()) return Promise.resolve();
    const shared = globalThis as Record<PropertyKey, unknown>;
    const waiters = (shared[SpawnerClient.WAITERS_KEY] as Array<() => void> | undefined) ?? [];
    shared[SpawnerClient.WAITERS_KEY] = waiters;
    return new Promise((resolve) => waiters.push(resolve));
  }

  get pid(): number | null {
    return this.spawnerPid;
  }

  /** Blocks until the spawner answers, so a failed fork is a startup error rather than a later surprise. */
  async ready(): Promise<unknown> {
    const answer = await this.channel.request<{ pid?: number }>('ping', {}, SpawnerClient.REQUEST_TIMEOUT_MS);
    this.spawnerPid = answer?.pid ?? this.spawnerPid;
    return answer;
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

  onOutput(id: string, listener: (stream: GuestOutputStream, line: string) => void): void {
    if (!this.outputListeners.has(id)) this.outputListeners.set(id, new Set());
    this.outputListeners.get(id)!.add(listener);
  }

  /** The connection to the spawner is gone (see `disconnected`). */
  onDisconnect(listener: () => void): void {
    this.disconnectListeners.add(listener);
  }

  /** A guest is gone for good (killed on purpose): its listeners go with it. */
  forget(id: string): void {
    this.exitListeners.delete(id);
    this.outputListeners.delete(id);
  }

  /**
   * The `extension-host` stops every guest of a connection that closes (`PrivilegedSpawner.shutdown`),
   * and no exit for them can arrive any more — so each is reported here, or the api would go on
   * believing they run. An api's OWN forked spawner is left as it always was: its guests may outlive it.
   */
  private disconnected(): void {
    // Disconnect listeners first: they withdraw this client, so a guest restarted because of the exits
    // below finds no spawner to start it with and waits for the next one instead.
    for (const listener of this.disconnectListeners) listener();
    if (this.hostedBy === SpawnerClient.HOSTED_BY_EXTENSION_HOST) {
      for (const listeners of [...this.exitListeners.values()]) for (const listener of [...listeners]) listener(null, SpawnerClient.DISCONNECTED, null);
    }
  }

  private notified(type: string, payload: any): void {
    const id = String(payload?.id ?? '');
    if (type === 'exit') {
      for (const listener of this.exitListeners.get(id) ?? []) listener(payload.code ?? null, payload.signal ?? null, payload.pid ?? null);
      return;
    }
    if (type === 'output') {
      for (const listener of this.outputListeners.get(id) ?? []) listener(payload.stream === String(GuestOutputStream.STDERR.value) ? GuestOutputStream.STDERR : GuestOutputStream.STDOUT, String(payload.line ?? ''));
    }
  }
}

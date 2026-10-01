import type { ChildProcess } from 'child_process';
import { IpcMessagePort } from '@core/process/ipc-message-port';
import { SocketMessagePort } from '@core/process/socket-message-port';
import type { IMessagePort } from '@core/process/interfaces/message-port.interface';
import { PluginChannel } from '@core/plugin/host/plugin-channel';
import type { IGuestIdentity } from '@core/process/interfaces/guest-identity.interface';
import type { IGuestProcessSpec } from '@core/process/interfaces/guest-process-spec.interface';
import type { ISpawnerPrepared } from '@core/process/interfaces/spawner-prepared.interface';
import type { ISpawnerGuestListing } from '@core/process/interfaces/spawner-guest-listing.interface';
import { GuestOutputStream } from '@core/process/enums/guest-output-stream.enum';
import { MessagePortEvent } from '@core/process/enums/message-port-event.enum';
import { SpawnerMessage } from '@core/process/enums/spawner-message.enum';
import { ExtensionHostPool } from '@core/process/extension-host/extension-host-pool';

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
  private static readonly CHANGE_LISTENERS_KEY = Symbol.for('fromcode.privileged-spawner.change-listeners');
  /** The exit reported for every guest when the `extension-host` connection is lost — they went with it. */
  static readonly DISCONNECTED = 'extension-host disconnected';
  /** `PluginProcessHost` values; literal here because process/ must not import plugin/host. */
  static readonly HOSTED_BY_API = 'api';
  static readonly HOSTED_BY_EXTENSION_HOST = 'extension-host';
  private static readonly REQUEST_TIMEOUT_MS = 30_000;

  private readonly channel: PluginChannel;
  private readonly exitListeners = new Map<string, Set<(code: number | null, signal: string | null, pid: number | null, reason?: string | null) => void>>();
  private readonly outputListeners = new Map<string, Set<(stream: GuestOutputStream, line: string) => void>>();
  private readonly disconnectListeners = new Set<() => void>();

  /** The spawner's pid, learned from its answer to `ping`. */
  private spawnerPid: number | null;
  /** The kernel the spawner sees (`os.release()`): a sandboxing runtime reports its own, not the box's. */
  kernel: string | null = null;

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
   * start WITH this reason — never quietly started somewhere else. Per pool (`ExtensionHostPool`).
   */
  static publishUnavailable(reason: string | null, pool: string = ExtensionHostPool.PLATFORM): void {
    (globalThis as Record<PropertyKey, unknown>)[SpawnerClient.keyFor(SpawnerClient.UNAVAILABLE_KEY, pool)] = reason ?? undefined;
  }

  static unavailableReason(pool: string = ExtensionHostPool.PLATFORM): string | null {
    return ((globalThis as Record<PropertyKey, unknown>)[SpawnerClient.keyFor(SpawnerClient.UNAVAILABLE_KEY, pool)] as string | undefined) ?? null;
  }

  static current(pool: string = ExtensionHostPool.PLATFORM): SpawnerClient | null {
    return ((globalThis as Record<PropertyKey, unknown>)[SpawnerClient.keyFor(SpawnerClient.GLOBAL_KEY, pool)] as SpawnerClient | undefined) ?? null;
  }

  /** `null` withdraws it: the connection to the `extension-host` was lost, and nothing can be started. */
  static publish(client: SpawnerClient | null, pool: string = ExtensionHostPool.PLATFORM): void {
    const shared = globalThis as Record<PropertyKey, unknown>;
    const previous = SpawnerClient.current(pool);
    shared[SpawnerClient.keyFor(SpawnerClient.GLOBAL_KEY, pool)] = client ?? undefined;
    if (!client) return;
    // A different host now starts new processes — a newer extension-host beside the old one. What runs
    // on the old one is moved over by whoever listens (the plugin hosts), one gapless swap at a time.
    if (previous && previous !== client) {
      for (const listener of (shared[SpawnerClient.CHANGE_LISTENERS_KEY] as Array<(pool: string) => void> | undefined) ?? []) listener(pool);
    }
    const waitersKey = SpawnerClient.keyFor(SpawnerClient.WAITERS_KEY, pool);
    const waiters = (shared[waitersKey] as Array<() => void> | undefined) ?? [];
    shared[waitersKey] = [];
    for (const resolve of waiters) resolve();
  }

  /** Called whenever a different spawner replaces the published one of a pool (never for the first, nor for none). */
  static onChange(listener: (pool: string) => void): void {
    const shared = globalThis as Record<PropertyKey, unknown>;
    const listeners = (shared[SpawnerClient.CHANGE_LISTENERS_KEY] as Array<(pool: string) => void> | undefined) ?? [];
    shared[SpawnerClient.CHANGE_LISTENERS_KEY] = listeners;
    listeners.push(listener);
  }

  /** Resolves once a spawner of `pool` is published — at once when one already is. */
  static whenAvailable(pool: string = ExtensionHostPool.PLATFORM): Promise<void> {
    if (SpawnerClient.current(pool)) return Promise.resolve();
    const shared = globalThis as Record<PropertyKey, unknown>;
    const waitersKey = SpawnerClient.keyFor(SpawnerClient.WAITERS_KEY, pool);
    const waiters = (shared[waitersKey] as Array<() => void> | undefined) ?? [];
    shared[waitersKey] = waiters;
    return new Promise((resolve) => waiters.push(resolve));
  }

  /**
   * The `globalThis` slot of one pool. The platform's keeps the key it always had, so a copy of this
   * class from before pools (the other bundle of core) still finds the same spawner.
   */
  private static keyFor(base: symbol, pool: string): symbol {
    return pool === ExtensionHostPool.PLATFORM ? base : Symbol.for(`${base.description}:${pool}`);
  }

  get pid(): number | null {
    return this.spawnerPid;
  }

  /** Blocks until the spawner answers, so a failed fork is a startup error rather than a later surprise. */
  async ready(): Promise<unknown> {
    const answer = await this.channel.request<{ pid?: number; kernel?: string }>(String(SpawnerMessage.PING.value), {}, SpawnerClient.REQUEST_TIMEOUT_MS);
    this.spawnerPid = answer?.pid ?? this.spawnerPid;
    this.kernel = answer?.kernel ?? null;
    return answer;
  }

  prepare(args: { id: string; identity: IGuestIdentity; appUid: number; appGid: number; writableDirs: string[] }): Promise<ISpawnerPrepared> {
    return this.channel.request<ISpawnerPrepared>(String(SpawnerMessage.PREPARE.value), args, SpawnerClient.REQUEST_TIMEOUT_MS);
  }

  spawn(spec: IGuestProcessSpec, hostSocket: string): Promise<{ pid: number }> {
    return this.channel.request<{ pid: number }>(String(SpawnerMessage.SPAWN.value), { ...spec, hostSocket }, SpawnerClient.REQUEST_TIMEOUT_MS);
  }

  /** Every process the spawner runs, with what its api labelled it — how another api finds one to take over. */
  inventory(): Promise<ISpawnerGuestListing[]> {
    return this.channel.request<ISpawnerGuestListing[]>(String(SpawnerMessage.INVENTORY.value), {}, SpawnerClient.REQUEST_TIMEOUT_MS);
  }

  /** Takes hold of a running process: its output and exit are told to this api too, and it may stop it. */
  claim(id: string): Promise<{ pid: number }> {
    return this.channel.request<{ pid: number }>(String(SpawnerMessage.CLAIM.value), { id }, SpawnerClient.REQUEST_TIMEOUT_MS);
  }

  kill(id: string, signal: NodeJS.Signals): void {
    this.channel.notify(String(SpawnerMessage.KILL.value), { id, signal });
  }

  /** `pid` names WHICH process of this id exited — a replaced predecessor's exit must not be taken for the current one's. */
  onExit(id: string, listener: (code: number | null, signal: string | null, pid: number | null, reason?: string | null) => void): void {
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
    if (type === String(SpawnerMessage.EXIT.value)) {
      for (const listener of this.exitListeners.get(id) ?? []) listener(payload.code ?? null, payload.signal ?? null, payload.pid ?? null, payload.reason ?? null);
      return;
    }
    if (type === String(SpawnerMessage.OUTPUT.value)) {
      for (const listener of this.outputListeners.get(id) ?? []) listener(payload.stream === String(GuestOutputStream.STDERR.value) ? GuestOutputStream.STDERR : GuestOutputStream.STDOUT, String(payload.line ?? ''));
    }
  }
}

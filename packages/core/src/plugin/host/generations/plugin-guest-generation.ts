import os from 'os';
import path from 'path';
import { randomBytes } from 'crypto';
import { PluginGuestConnections } from '@core/plugin/host/connections/plugin-guest-connections';
import { PluginChannel } from '@core/plugin/host/plugin-channel';
import type { IGuestProcess } from '@core/process/interfaces/guest-process.interface';
import type { IPluginGuestRegistration } from '@core/plugin/host/interfaces/plugin-guest-registration.interface';
import type { IPluginProtocolIdentity } from '@core/plugin/host/protocol/interfaces/plugin-protocol-identity.interface';

/**
 * ONE process of a plugin — its channel, its routes socket, what it answered at boot.
 *
 * A plugin used to have exactly one process, replaced by killing it and starting another: everything
 * sent to the plugin in between failed (a 502 from the dead socket, a 404 from the new one before its
 * `onInit` had mounted any route). With generations, the next process starts BESIDE the current one,
 * boots and initialises while the current one keeps serving, and only then takes over; the old one
 * finishes what it was doing and is retired.
 *
 * While it boots as a replacement, the registrations it sends are HELD, not applied: the current
 * process's stand-ins stay in place until the switch, which applies these in one step.
 */
export class PluginGuestGeneration {
  static readonly ROUTES_SOCKET = 'routes.sock';
  private static readonly DRAIN_POLL_MS = 50;

  described: { contractKeys: string[]; publicApiKeys: string[]; manifest: unknown; protocol?: IPluginProtocolIdentity } | null = null;
  /** What another api must present to attach to this process (`PluginGuestConnections`). */
  readonly attachSecret = randomBytes(32).toString('hex');
  /** Registrations sent before this generation became the current one, in the order they came. */
  readonly held: IPluginGuestRegistration[] = [];

  constructor(
    /** 1 for the first process this host started, then one more per replacement. */
    readonly number: number,
    readonly guest: IGuestProcess,
    readonly channel: PluginChannel,
  ) {}

  get socketPath(): string {
    return path.join(this.guest.socketDir, PluginGuestGeneration.ROUTES_SOCKET);
  }

  /** Where another api attaches to this process. */
  get controlSocketPath(): string {
    return path.join(this.guest.socketDir, PluginGuestConnections.CONTROL_SOCKET);
  }

  /**
   * The guest id for a plugin's Nth process: distinct per generation, so two can run side by side — and
   * per api instance, because the `extension-host` container's spawner serves every api at once (two of
   * them during a rolling deploy), and a shared id would have one api's process replace the other's.
   */
  static guestId(slug: string, generation: number, instance: string = PluginGuestGeneration.instance()): string {
    return `plugin-${slug}.${instance}.${generation}`;
  }

  /** This api instance, as an id-safe token: the container's hostname, which is unique per container. */
  static instance(): string {
    return os.hostname().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24) || 'api';
  }

  /**
   * Waits until nothing is in flight to this process — no message awaiting its answer, no HTTP request
   * being served — or until `timeoutMs`. Answers whether it drained.
   */
  async drain(inFlightHttp: (socketPath: string) => number, timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      if (this.channel.pendingCount === 0 && inFlightHttp(this.socketPath) === 0) return true;
      if (Date.now() >= deadline) return false;
      await new Promise((resolve) => setTimeout(resolve, PluginGuestGeneration.DRAIN_POLL_MS));
    }
  }

  /** A replaced process: waits for its in-flight work (up to `drainMs`; 0 = not at all), then retires it. */
  async retireAfter(drainMs: number, inFlightHttp: (socketPath: string) => number, logger: { info(message: string): void; warn(message: string): void }): Promise<void> {
    const drained = drainMs <= 0 || await this.drain(inFlightHttp, drainMs);
    if (!drained) logger.warn(`replaced process ${this.guest.pid} still had work after ${drainMs} ms; stopping it anyway`);
    await this.retire();
    logger.info(`replaced process ${this.guest.pid} retired`);
  }

  /** Asks the process to stop (it closes its routes server), then makes sure it is gone. */
  async retire(): Promise<void> {
    if (!this.channel.isClosed) await this.channel.request('stop', {}, 5_000).catch(() => undefined);
    this.guest.kill('SIGKILL');
    this.channel.close();
  }
}

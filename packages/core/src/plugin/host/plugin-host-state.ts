import type { IGuestProcess } from '@core/process/interfaces/guest-process.interface';
import type { PluginContext } from '@core/plugin/plugin-context';
import { Logger } from '@core/logging';
import { PluginChannel } from '@core/plugin/host/plugin-channel';
import { PluginHostCallbacks } from '@core/plugin/host/plugin-host-callbacks';
import { PluginHostDispatcher } from '@core/plugin/host/plugin-host-dispatcher';
import { PluginHostHttpProxy } from '@core/plugin/host/plugin-host-http-proxy';
import { PluginHostRegistrations } from '@core/plugin/host/plugin-host-registrations';
import type { PluginHostOutage } from '@core/plugin/host/outage/plugin-host-outage';
import { PluginIsolationSettings } from '@core/plugin/host/plugin-isolation-settings';
import type { IPluginGuestRegistration } from '@core/plugin/host/interfaces/plugin-guest-registration.interface';
import type { PluginGuestGeneration } from '@core/plugin/host/generations/plugin-guest-generation';

/**
 * Everything a `PluginHost` holds, declared once for both halves.
 *
 * EVERY field here must be assigned in `PluginHost`'s constructor, including the ones whose starting
 * value is `null`, `false` or `0`. `declare` emits NOTHING, so a field initialiser moved up here
 * simply stops running and the compiler says nothing: `tokens` became `undefined`, `invoke()` called
 * `this.tokens.mint(...)`, and twelve plugins failed `onInit` on a local boot, each reported as its
 * own unrelated-looking "failed to register". `arch-guard declared-fields` now refuses this.
 *
 * `declare` only — the host owns the real fields and assigns them in its constructor. A `declare`d
 * field carrying an initialiser would simply never run.
 */
export abstract class PluginHostState {
  /** Mirrors `PluginManager.PLUGINS_READY_EVENT`, re-emitted when this guest is replaced. A literal
   *  rather than an import: the host cannot import the manager without a cycle. */
  static readonly PLUGINS_READY_EVENT = 'plugins:ready';

  protected static readonly MAX_RESTARTS = 3;
  protected static readonly BOOT_TIMEOUT_MS = 60_000;
  protected static readonly HEALTHY_AFTER_MS = 60_000;
  protected declare logger: Logger;
  protected declare tokens: any;
  protected declare limits: { memoryMb: number; timeoutMs: number };
  protected declare socketPath: any;
  protected declare proxy: PluginHostHttpProxy;
  protected declare registrations: PluginHostRegistrations;
  /** What a request meets while no process is running. */
  protected declare outage: PluginHostOutage;
  protected declare dispatcher: PluginHostDispatcher;
  protected declare callbacks: PluginHostCallbacks;
  protected declare settings: PluginIsolationSettings;
  protected declare guest: IGuestProcess | null;
  /** The process that is serving now; `guest`, `channel` and the proxy's socket are always its. */
  protected declare generation: PluginGuestGeneration | null;
  /** How many processes this host has started — each replacement's process gets the next number. */
  protected declare generationCount: number;
  protected declare channel: PluginChannel | null;
  protected declare context: PluginContext | null;
  protected declare describeResult: { contractKeys: string[]; publicApiKeys: string[]; manifest: unknown } | null;
  protected declare restarts: any;
  protected declare stopping: any;
  protected declare restarting: any;
  protected declare healthyTimer: NodeJS.Timeout | null;
  protected declare wasEnabled: any;
  protected declare initDeferred: any;
  /** What a process this api took over had registered, restored when the boot's `onInit` would run; null otherwise. */
  protected declare takenOver: IPluginGuestRegistration[] | null;
  /**
   * The peer snapshot last SENT to the guest, as a signature. Empty means the guest holds whatever
   * its boot left it — which is why it is cleared wherever the channel is. See `PluginHost.syncPeers`.
   */
  protected declare sentPeerSignature: string;

  /**
   * Set in the constructor from its parameters, declared here so the guest-bridge half can read them.
   *
   * `slug` and `identity` are PUBLIC because `PluginHostRegistry` reads them off a host it holds; the
   * rest are internal. None is `readonly` — the constructor assigns them, and a readonly field cannot
   * be assigned from a subclass constructor.
   */
  declare slug: string;
  declare identity: any;
  protected declare manager: any;
  protected declare manifest: Record<string, unknown>;
  protected declare pluginDir: string;
  protected declare entryPath: string;
  protected declare projectRoot: string;

  /**
   * Implemented on `PluginHost` itself and called from the guest-bridge half: a crashed guest is
   * relaunched by calling `start` again, and every message it sends is dispatched through `invoke`.
   */
  abstract start(): Promise<{ contractKeys: string[]; publicApiKeys: string[]; manifest: unknown }>;
  protected abstract invoke(work: any, store: any, channel?: any): Promise<unknown>;
  protected abstract launchGeneration(): Promise<PluginGuestGeneration>;
  protected abstract stubs(): Record<string, unknown>;
}

import type { IGuestProcess } from '@core/process/interfaces/guest-process.interface';
import type { PluginContext } from '@core/plugin/plugin-context';
import { Logger } from '@core/logging';
import { PluginChannel } from '@core/plugin/host/plugin-channel';
import { PluginHostCallbacks } from '@core/plugin/host/plugin-host-callbacks';
import { PluginHostDispatcher } from '@core/plugin/host/plugin-host-dispatcher';
import { PluginHostHttpProxy } from '@core/plugin/host/plugin-host-http-proxy';
import { PluginHostRegistrations } from '@core/plugin/host/plugin-host-registrations';
import { PluginIsolationSettings } from '@core/plugin/host/plugin-isolation-settings';

/**
 * Everything a `PluginHost` holds, declared once for both halves.
 *
 * `declare` only — the host owns the real fields and assigns them in its constructor. A `declare`d
 * field carrying an initialiser would simply never run.
 */
export abstract class PluginHostState {
  /** The guest's Express server socket, inside the directory only the host and that guest can reach. */
  static readonly ROUTES_SOCKET = 'routes.sock';

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
  protected declare dispatcher: PluginHostDispatcher;
  protected declare callbacks: PluginHostCallbacks;
  protected declare settings: PluginIsolationSettings;
  protected declare guest: IGuestProcess | null;
  protected declare channel: PluginChannel | null;
  protected declare context: PluginContext | null;
  protected declare describeResult: { contractKeys: string[]; publicApiKeys: string[]; manifest: unknown } | null;
  protected declare restarts: any;
  protected declare stopping: any;
  protected declare restarting: any;
  protected declare healthyTimer: NodeJS.Timeout | null;
  protected declare wasEnabled: any;
  protected declare initDeferred: any;

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
  protected abstract invoke(work: any, store: any): Promise<unknown>;
  protected abstract stubs(): Record<string, unknown>;
}

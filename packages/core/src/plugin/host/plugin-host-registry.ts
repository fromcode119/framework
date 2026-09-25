import { Logger } from '@core/logging';
import { SystemConstants } from '@core/constants/system.constants';
import { SettingChangeInvalidators } from '@core/settings/setting-change-invalidators';
import { PluginHost } from '@core/plugin/host/plugin-host';
import { PluginIsolationIdentityService } from '@core/plugin/host/plugin-isolation-identity-service';
import { PluginIsolationSettings } from '@core/plugin/host/plugin-isolation-settings';
import { GuestProcessLaunchers } from '@core/process/guest-process-launchers';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';

/**
 * Every isolated plugin's host, by slug — owned by the plugin manager.
 *
 * The scanner asks it to `describe` a plugin instead of `require`-ing the module in the api process:
 * that is the moment the guest process is born, and from then on the api never executes the
 * plugin's code itself.
 */
export class PluginHostRegistry {
  private readonly logger = new Logger({ namespace: 'plugin-hosts' });
  private readonly hosts = new Map<string, PluginHost>();
  private settings: PluginIsolationSettings | null = null;
  private readonly identities: PluginIsolationIdentityService;

  /** The Settings → Infrastructure → Plugin Isolation keys this registry derives its limits from. */
  private static readonly SETTING_KEYS = [
    SystemConstants.META_KEY.PLUGIN_ISOLATION_DEFAULT,
    SystemConstants.META_KEY.PLUGIN_ISOLATION_MEMORY_MB,
    SystemConstants.META_KEY.PLUGIN_ISOLATION_TIMEOUT_MS,
  ];

  constructor(private readonly manager: IPluginManagerInterface, private readonly projectRoot: string) {
    this.identities = new PluginIsolationIdentityService(() => manager.db as any);
    // Read once and handed to every host, so a save changed nothing — not even for a process started
    // afterwards — until the api restarted, while the admin said it applied to new processes.
    SettingChangeInvalidators.register(PluginHostRegistry.SETTING_KEYS, () => {
      this.refreshSettings().catch((error) => this.logger.error(
        `Saved plugin isolation settings could not be applied: ${error instanceof Error ? error.message : String(error)}`,
      ));
    });
  }

  /**
   * Re-reads the saved settings and hands them to every host: a new deadline applies to the next call,
   * a new heap ceiling restarts that plugin's own process (the api and the other plugins keep running).
   *
   * WHERE a plugin runs (the default mode) is not changed here: moving a plugin into or out of the api
   * process means loading its code differently, which happens when the api loads plugins. A newly
   * installed plugin follows the new default at once; the admin offers the restart for the rest.
   */
  async refreshSettings(): Promise<void> {
    this.settings = null;
    const settings = await this.settingsInEffect();
    await Promise.all([...this.hosts.values()].map((host) => host.applySettings(settings).catch((error) => {
      this.logger.warn(`Plugin "${host.slug}" keeps its previous isolation limits: ${error instanceof Error ? error.message : String(error)}`);
    })));
  }

  /** The platform's declared isolation settings, re-read whenever they are saved. */
  async settingsInEffect(): Promise<PluginIsolationSettings> {
    if (!this.settings) {
      try {
        this.settings = await PluginIsolationSettings.read(this.manager.db);
      } catch (error) {
        this.logger.warn(`Could not read plugin isolation settings; using the declared defaults: ${error instanceof Error ? error.message : String(error)}`);
        this.settings = PluginIsolationSettings.defaults();
      }
    }
    return this.settings;
  }

  /** Whether `manifest.sandbox` plus the platform default put this plugin in its own process. */
  async isIsolated(sandbox: unknown): Promise<boolean> {
    return (await this.settingsInEffect()).isIsolated(sandbox);
  }

  /**
   * Registers the plugin's host and returns the lifecycle stubs the scanner stages.
   *
   * Only an ACTIVE plugin's process is started here. An inactive plugin costs no process until an
   * operator enables it — twenty-odd idle guests at boot is what put the api over its memory ceiling
   * on the first run. Its `onInit` is deferred and runs the moment `onEnable` starts the guest.
   */
  async describe(slug: string, pluginDir: string, entryPath: string, manifest: Record<string, unknown>, active: boolean): Promise<Record<string, unknown>> {
    let host = this.hosts.get(slug);
    if (!host) {
      host = new PluginHost(slug, pluginDir, entryPath, manifest, this.manager, await this.settingsInEffect(), this.projectRoot, await this.identities.identityFor(slug));
      this.hosts.set(slug, host);
    }
    const described = active ? await host.start() : null;
    return { ...host.stubs(), manifest: described?.manifest ?? undefined };
  }

  /**
   * An isolated plugin whose files were replaced: its process is swapped for one running the new code,
   * with no api restart. False when the plugin has no host (shared) — the caller restarts the api, as before.
   */
  async reload(slug: string, manifest: Record<string, unknown>): Promise<boolean> {
    const host = this.hosts.get(slug);
    if (!host) return false;
    await host.reload(manifest);
    return true;
  }

  get(slug: string): PluginHost | null {
    return this.hosts.get(slug) ?? null;
  }

  async stop(slug: string): Promise<void> {
    const host = this.hosts.get(slug);
    if (!host) return;
    await host.stop();
    this.hosts.delete(slug);
  }

  async stopAll(): Promise<void> {
    await Promise.all([...this.hosts.keys()].map((slug) => this.stop(slug)));
  }

  /** Whether guests run as their own OS users here (a privileged spawner exists) or share the api's. */
  isolatesIdentity(): boolean {
    return GuestProcessLaunchers.current().isolatesIdentity;
  }

  /** For the admin: which plugins run in their own process right now. */
  status(): Array<{ slug: string; pid: number | null; uid: number | null; memoryMb: number; timeoutMs: number }> {
    return [...this.hosts.values()].map((host) => ({ slug: host.slug, pid: host.pid, uid: host.identity?.uid ?? null, ...host.limitsInEffect }));
  }
}

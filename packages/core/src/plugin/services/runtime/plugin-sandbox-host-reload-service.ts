import { Logger } from '@core/logging';
import { PluginRuntimeRestartService } from '@core/plugin/services/runtime/plugin-runtime-restart-service';
import type { ISandboxHostReloadResult } from '@core/plugin/interfaces/sandbox-host-reload-result.interface';

/** What `PluginHostRegistry` needs to expose for a sandbox save to react to — narrow on purpose so this stays testable without a real registry. */
export interface IPluginSandboxHostAccess {
  get(slug: string): unknown | null;
  isIsolated(sandbox: unknown): Promise<boolean>;
  reload(slug: string, manifest: Record<string, unknown>): Promise<boolean>;
  stop(slug: string): Promise<void>;
}

/**
 * What happens to an isolated plugin's PROCESS once an operator saves its sandbox config.
 *
 * `reload` (see `PluginHostRegistry.reload`) is only correct for ONE of the three transitions a
 * save can cause — staying isolated. Calling it unconditionally on every save (as `saveSandboxConfig`
 * used to) got the other two wrong in opposite directions:
 *
 *  - going from isolated to shared SIGKILLed the guest, replayed onInit/onEnable and re-emitted
 *    `plugins:ready` to every peer, then left the plugin isolated anyway — becoming "shared" needs
 *    the plugin's code loaded INTO the api process, which only happens at boot/rescan.
 *  - going from shared to isolated has no host to reload (`PluginHostRegistry.reload` returns
 *    `false` for a plugin the boot scanner never staged into its own process), so the row was
 *    updated and nothing else happened, silently, while the admin reported success.
 *
 * Both of those transitions are told the truth instead: the setting is saved, and an API restart —
 * scheduled the same way the install path already schedules one — is what makes it take effect.
 */
export class PluginSandboxHostReloadService {
  constructor(
    private readonly hosts: IPluginSandboxHostAccess,
    private readonly logger: Logger,
    private readonly runtimeRestartFactory: () => PluginRuntimeRestartService = () => new PluginRuntimeRestartService(logger),
  ) {}

  async apply(slug: string, manifest: Record<string, unknown>): Promise<ISandboxHostReloadResult> {
    const wasIsolated = Boolean(this.hosts.get(slug));
    const willBeIsolated = await this.hosts.isIsolated((manifest as { sandbox?: unknown }).sandbox);

    if (wasIsolated && willBeIsolated) {
      try {
        await this.hosts.reload(slug, manifest);
        return { restartRequired: false };
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Sandbox limits for "${slug}" were saved, but its process could not be restarted on them: ${reason}`);
        return { restartRequired: true, restartFailed: true, reason };
      }
    }

    if (wasIsolated && !willBeIsolated) {
      await this.hosts.stop(slug);
      this.runtimeRestartFactory().scheduleRestart(`Plugin "${slug}" sandbox isolation was disabled.`);
      return { restartRequired: true };
    }

    if (!wasIsolated && willBeIsolated) {
      this.runtimeRestartFactory().scheduleRestart(`Plugin "${slug}" sandbox isolation was enabled.`);
      return { restartRequired: true };
    }

    return { restartRequired: false };
  }
}

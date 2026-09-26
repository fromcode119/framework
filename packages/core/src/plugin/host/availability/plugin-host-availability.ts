import type { Request, Response, NextFunction } from 'express';
import type { IRequestStore } from '@core/context/interfaces/request-store.interface';
import { PluginHostGuestBridge } from '@core/plugin/host/plugin-host-guest-bridge';
import { PluginInvocationKind } from '@core/plugin/host/enums/plugin-invocation-kind.enum';
import { PluginSiteDataReplay } from '@core/plugin/tenant/plugin-site-data-replay';
import { GuestProcessLaunchers } from '@core/process/guest-process-launchers';

/**
 * A plugin whose process cannot be started because the `extension-host` is out of reach.
 *
 * At boot an active plugin's `onInit` and `onEnable` both start its process. With nowhere to start it,
 * both threw, the plugin was marked failed — and everything that depends on it with it — and it stayed
 * failed after the extension-host came back, until somebody restarted the api. Here the plugin boots
 * like an inactive one: what boot would have run is remembered, and runs the moment the extension-host
 * answers — `onInit`, the per-site data pass that follows it at boot, then `onEnable`.
 */
export abstract class PluginHostAvailability extends PluginHostGuestBridge {
  /** Starts the process and runs the `onInit` that was deferred while it was not running. */
  async resume(store: IRequestStore | undefined): Promise<void> {
    await this.start();
    if (!this.initDeferred) return;
    this.initDeferred = false;
    await this.invoke({ kind: String(PluginInvocationKind.LIFECYCLE.value), name: 'onInit' }, store);
  }

  /**
   * For a lifecycle call on a plugin that is not running: true when it was deferred because nothing can
   * be started right now (the caller returns), false when the caller should start the process.
   */
  protected deferWhileUnavailable(key: string): boolean {
    if (!GuestProcessLaunchers.unavailableReason()) return false;
    if (key === 'onInit') {
      if (!this.initDeferred) this.answerWhileDown();
      this.initDeferred = true;
      return true;
    }
    if (key === 'onEnable') { this.wasEnabled = true; return true; }
    return false;
  }

  /**
   * Its routes are registered by the `onInit` that has not run, so a request for one met a bare 404 —
   * or the collection proxy's "Collection not found" — that said nothing true. Until the process runs,
   * everything under the plugin's own path answers why. Mounted in the plugin's namespace, after the
   * platform's own `/plugins/<slug>` endpoints, so those still answer.
   */
  private answerWhileDown(): void {
    // A plugin without the `api` capability has no routes to answer for, and may not mount any.
    if (!((this.manifest.capabilities ?? []) as string[]).includes('api')) return;
    this.context?.api.use('/', (req: Request, res: Response, next: NextFunction) => {
      if (this.channel && !this.channel.isClosed) return next();
      this.outage.handle(req, res, next, undefined);
    });
  }

  /**
   * A process this api took over already ran its `onInit` and `onEnable` — for the api before this one.
   * Running them again would start its timers and subscriptions twice in the same process. Instead the
   * boot's `onInit` restores, in order, what the process had registered (its routes, hooks, and what it
   * declared: `PluginDeclarations`), the per-site passes are skipped (their data is already there), and
   * `onEnable` only notes that the plugin is enabled. Lifecycle calls after that run as usual.
   */
  protected async restoreTakenOver(key: string): Promise<boolean> {
    if (!this.takenOver || !this.context) return false;
    if (key === 'onInit') {
      const restoring = this.takenOver.splice(0);
      for (const registration of restoring) await this.registrations.apply(this.context, registration);
      if (restoring.length) this.logger.info(`restored ${restoring.length} registrations from the process it took over`);
      return true;
    }
    if (key === 'onEnable') { this.wasEnabled = true; this.takenOver = null; return true; }
    return false;
  }

  /** Waits for the extension-host, then runs what boot could not. */
  async resumeWhenAvailable(): Promise<void> {
    await GuestProcessLaunchers.whenAvailable();
    if (this.stopping || this.guest) return;
    try {
      const initDeferred = this.initDeferred;
      await this.resume(undefined);
      const plugin = this.manager.plugins.get(this.slug);
      const context = this.context;
      // The replay binds a per-site view of the context while it runs; the plugin's own comes back after.
      if (initDeferred && plugin && context) await PluginSiteDataReplay.run(plugin, context, this.manager.db, this.logger);
      if (context) this.context = context;
      if (this.wasEnabled) await this.invoke({ kind: String(PluginInvocationKind.LIFECYCLE.value), name: 'onEnable' }, undefined);
      this.logger.info('started now that the extension-host answers');
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`could not start once the extension-host answered: ${reason}`);
      await this.manager.disableWithError(this.slug, `Isolated plugin process failed to start: ${reason}`);
    }
  }
}

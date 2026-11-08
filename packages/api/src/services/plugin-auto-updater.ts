import { ApiWorkers, SystemConstants, SystemSettingRegistry, PlatformSettingsService } from '@fromcode119/core';
import type { PluginManager } from '@fromcode119/core';
import { PluginsChangedSignal } from '@api/services/plugins-changed-signal';
import { PlatformMetaStore } from '@api/services/system/platform-meta-store';
import type { IPluginAutoUpdateStatus } from '@api/services/interfaces/plugin-auto-update-status.interface';

/**
 * Installs newer marketplace versions of the installed plugins while the operator's switch
 * (Settings → Updates → `plugins_auto_update`) is on.
 *
 * It does what the "Update all" button does — one batch, one restart at the end — on a timer, so nobody
 * has to open the marketplace to find out something was released. A version that asks for a permission
 * nobody approved still arrives held, exactly as it does by hand. Runs in the first api worker only.
 */
export class PluginAutoUpdater {
  /** Declared here and said on Settings → Updates ("checked every hour"), so it is not a hidden number. */
  static readonly INTERVAL_MS = 60 * 60 * 1000;
  /** The first check waits for the plugins to finish loading — the catalogue is compared with what is installed. */
  static readonly FIRST_CHECK_MS = 10 * 60 * 1000;

  private static instance: PluginAutoUpdater | null = null;

  /** The one updater of this api process — the boot sequence starts and stops it. */
  static for(manager: Pick<PluginManager, 'updateAllFromMarketplace'>, db: any, logger: { info(message: string): void; error(message: string, error?: unknown): void }): PluginAutoUpdater {
    PluginAutoUpdater.instance ??= new PluginAutoUpdater(manager, db, logger);
    return PluginAutoUpdater.instance;
  }

  private timer: ReturnType<typeof setInterval> | null = null;
  private first: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private readonly meta: PlatformMetaStore;

  constructor(
    private readonly manager: Pick<PluginManager, 'updateAllFromMarketplace'>,
    db: any,
    private readonly logger: { info(message: string): void; error(message: string, error?: unknown): void },
  ) {
    this.meta = new PlatformMetaStore(db);
  }

  start(): void {
    if (!ApiWorkers.isFirstWorker()) return;
    this.first = setTimeout(() => {
      void this.check();
      this.timer = setInterval(() => { void this.check(); }, PluginAutoUpdater.INTERVAL_MS);
      this.timer.unref?.();
    }, PluginAutoUpdater.FIRST_CHECK_MS);
    this.first.unref?.();
  }

  stop(): void {
    if (this.first) clearTimeout(this.first);
    if (this.timer) clearInterval(this.timer);
    this.first = null;
    this.timer = null;
  }

  /** One check. Never throws: a timer must not take the api down, and the report says what happened. */
  async check(): Promise<void> {
    if (this.running || !(await this.enabled()) || await this.platformUpdateRequested()) return;
    this.running = true;
    try {
      const previous = await this.previous();
      const status: IPluginAutoUpdateStatus = { ...previous, checkedAt: new Date().toISOString(), failed: [], error: '' };
      try {
        const result = await PluginsChangedSignal.around('', () => this.manager.updateAllFromMarketplace());
        status.failed = result.failed;
        if (result.updated.length) {
          status.updated = result.updated;
          status.updatedAt = status.checkedAt;
          this.logger.info(`Automatic plugin update installed: ${result.updated.join(', ')}`);
        }
        for (const failure of result.failed) this.logger.error(`Automatic plugin update of "${failure.slug}" failed: ${failure.error}`);
      } catch (error) {
        status.error = String((error as Error)?.message ?? error).slice(0, 500);
        this.logger.error(`Automatic plugin update could not check the marketplace: ${status.error}`);
      }
      await this.meta.write(SystemConstants.META_KEY.PLUGINS_AUTO_UPDATE_STATUS, JSON.stringify(status));
    } catch (error) {
      this.logger.error('Automatic plugin update failed', error);
    } finally {
      this.running = false;
    }
  }

  /** Never saved = the declared default, which Settings → Updates shows as the switch's state. */
  private async enabled(): Promise<boolean> {
    const key = SystemConstants.META_KEY.PLUGINS_AUTO_UPDATE;
    return ((await PlatformSettingsService.getSetting(key)) ?? SystemSettingRegistry.defaultValueOf(key)) === 'true';
  }

  /** A platform update restarts the api; replacing plugins in the middle of it would only race it. */
  private async platformUpdateRequested(): Promise<boolean> {
    return Boolean(await PlatformSettingsService.getSetting(SystemConstants.META_KEY.FRAMEWORK_UPDATE_REQUEST));
  }

  private async previous(): Promise<IPluginAutoUpdateStatus> {
    try {
      const stored = JSON.parse((await this.meta.read(SystemConstants.META_KEY.PLUGINS_AUTO_UPDATE_STATUS)) ?? '');
      return { checkedAt: '', updatedAt: String(stored?.updatedAt ?? ''), updated: Array.isArray(stored?.updated) ? stored.updated.map(String) : [], failed: [], error: '' };
    } catch {
      return { checkedAt: '', updatedAt: '', updated: [], failed: [], error: '' };
    }
  }
}

import { SystemConstants } from '@core/constants/system.constants';
import { CoercionUtils } from '@core/utils/coercion-utils';
import { GeoDatabaseSource } from '@core/geo/geo-database-source';
import { GeoDatabaseStore } from '@core/geo/geo-database-store';
import type { IGeoDatabaseStatus } from '@core/geo/interfaces/geo-database-status.interface';
import fs from 'fs';

/**
 * Keeps the IP-location database in the state the operator chose (`geo_ip_lookup`).
 *
 * On: install the current month's edition when a newer one exists — the previous month's when the
 * current one is not published yet. Off: remove the file, so no location data stays on the server.
 * Checked at boot, daily, and whenever the operator presses "Update now" or changes the switch. Runs in
 * the api only; the extension host just reads the shared file.
 */
export class GeoDatabaseUpdater {
  private static readonly INTERVAL_MS = 86_400_000;
  private static instance: GeoDatabaseUpdater | null = null;

  /** The one updater of this api process — the boot sequence starts it, the admin routes ask it. */
  static for(db: any, logger: { info(message: string): void; error(message: string, error?: unknown): void }): GeoDatabaseUpdater {
    GeoDatabaseUpdater.instance ??= new GeoDatabaseUpdater(db, logger);
    return GeoDatabaseUpdater.instance;
  }

  private timer: ReturnType<typeof setInterval> | null = null;
  private running: Promise<IGeoDatabaseStatus> | null = null;

  constructor(
    private readonly db: any,
    private readonly logger: { info(message: string): void; error(message: string, error?: unknown): void },
    private readonly store: GeoDatabaseStore = new GeoDatabaseStore(),
    private readonly now: () => Date = () => new Date(),
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  start(): void {
    void this.apply();
    this.timer = setInterval(() => { void this.apply(); }, GeoDatabaseUpdater.INTERVAL_MS);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async enabled(): Promise<boolean> {
    try {
      const row = await this.db.findOne(SystemConstants.TABLE.META, { key: SystemConstants.META_KEY.GEO_IP_LOOKUP });
      return CoercionUtils.toBoolean(row?.value);
    } catch {
      return false;
    }
  }

  async status(): Promise<IGeoDatabaseStatus> {
    const state = this.store.readState();
    const installed = fs.existsSync(this.store.databasePath);
    return {
      enabled: await this.enabled(),
      edition: installed ? state.edition : '',
      installedAt: installed ? state.installedAt : '',
      sizeBytes: this.store.sizeBytes(),
      lastCheckedAt: state.lastCheckedAt,
      lastError: state.lastError,
      source: GeoDatabaseSource.attribution(),
    };
  }

  /** Bring the file in line with the switch. One run at a time; a caller during a run gets its result. */
  apply(): Promise<IGeoDatabaseStatus> {
    if (!this.running) {
      this.running = this.run().finally(() => { this.running = null; });
    }
    return this.running;
  }

  private async run(): Promise<IGeoDatabaseStatus> {
    try {
      if (!(await this.enabled())) {
        if (fs.existsSync(this.store.databasePath)) {
          fs.rmSync(this.store.databasePath, { force: true });
          this.store.writeState({ edition: '', installedAt: '', lastError: '' });
          this.logger.info('[geo] IP-location lookups switched off; the database was removed.');
        }
        return this.status();
      }
      const current = GeoDatabaseSource.editionFor(this.now());
      const installed = fs.existsSync(this.store.databasePath) ? this.store.readState().edition : '';
      if (installed === current) {
        this.store.writeState({ lastCheckedAt: this.now().toISOString(), lastError: '' });
        return this.status();
      }
      for (const edition of [current, GeoDatabaseSource.previousEdition(current)]) {
        if (installed && edition <= installed) break;
        try {
          await this.store.install(edition, this.fetcher);
          this.store.writeState({ lastCheckedAt: this.now().toISOString() });
          this.logger.info(`[geo] Installed IP-location database edition ${edition}.`);
          return this.status();
        } catch (error) {
          this.store.writeState({ lastCheckedAt: this.now().toISOString(), lastError: `Edition ${edition}: ${String((error as Error)?.message ?? error)}` });
        }
      }
      if (installed) this.store.writeState({ lastError: '' });
      return this.status();
    } catch (error) {
      this.logger.error('[geo] Updating the IP-location database failed', error);
      this.store.writeState({ lastCheckedAt: this.now().toISOString(), lastError: String((error as Error)?.message ?? error) });
      return this.status();
    }
  }
}

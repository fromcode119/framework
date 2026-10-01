import { SystemConstants } from '@core/constants/system.constants';
import type { IMonitoringIncident } from '@core/monitoring/interfaces/monitoring-incident.interface';

/**
 * The incidents open right now, kept in one platform row of `_system_meta`. Small by nature — one entry
 * per thing that is wrong — and read whole by the monitor and by the Health page.
 *
 * Written with the platform-admin marker: the monitor runs with no site bound, and these rows belong to
 * no site.
 */
export class MonitoringIncidentStore {
  constructor(private readonly db: any) {}

  async readOpen(): Promise<IMonitoringIncident[]> {
    return this.readJson<IMonitoringIncident[]>(SystemConstants.META_KEY.MONITORING_OPEN_INCIDENTS, []);
  }

  async writeOpen(incidents: IMonitoringIncident[]): Promise<void> {
    await this.write(SystemConstants.META_KEY.MONITORING_OPEN_INCIDENTS, JSON.stringify(incidents));
  }

  async readSyncedTargets(): Promise<string> {
    return this.readRaw(SystemConstants.META_KEY.MONITORING_SYNCED_TARGETS);
  }

  async writeSyncedTargets(fingerprint: string): Promise<void> {
    await this.write(SystemConstants.META_KEY.MONITORING_SYNCED_TARGETS, fingerprint);
  }

  private async readJson<T>(key: string, empty: T): Promise<T> {
    const raw = await this.readRaw(key);
    if (!raw) return empty;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return empty;
    }
  }

  private async readRaw(key: string): Promise<string> {
    const row = await this.db.withPlatformAdmin(() => this.db.findOne(SystemConstants.TABLE.META, { key }));
    return String(row?.value ?? '');
  }

  private async write(key: string, value: string): Promise<void> {
    await this.db.withPlatformAdmin(async () => {
      const existing = await this.db.findOne(SystemConstants.TABLE.META, { key });
      if (existing) {
        await this.db.update(SystemConstants.TABLE.META, { key }, { value, updated_at: new Date() });
        return;
      }
      await this.db.insert(SystemConstants.TABLE.META, { key, value, group: 'monitoring', description: 'Written by the platform monitor.' });
    });
  }
}

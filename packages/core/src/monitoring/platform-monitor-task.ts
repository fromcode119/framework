import { Logger } from '@core/logging';
import { ApiPathUtils } from '@core/api/api-path-utils';
import { SystemApiPaths } from '@core/constants/system-api-paths.constants';
import { SystemConstants } from '@core/constants/system.constants';
import { EnvUtils } from '@core/utils/env-utils';
import { PlatformSettingsService } from '@core/management/platform-settings-service';
import { MonitoringChange } from '@core/monitoring/enums/monitoring-change.enum';
import { MonitoringIncidentStore } from '@core/monitoring/monitoring-incident-store';
import { MonitoringProviderFactory } from '@core/monitoring/monitoring-provider-factory';
import { PlatformHealthChecks } from '@core/monitoring/platform-health-checks';
import type { IMonitoringIncident } from '@core/monitoring/interfaces/monitoring-incident.interface';
import type { IMonitoringTarget } from '@core/monitoring/interfaces/monitoring-target.interface';
import type { TenantRecord } from '@core/tenant/tenant-record';
import { TenantRegistryService } from '@core/tenant/provisioning/tenant-registry-service';
import { TenantResolverService } from '@core/tenant/tenant-resolver-service';

/**
 * The platform monitor: every five minutes, what is wrong now against what was wrong before.
 *
 * An incident is announced once when it opens and once when it resolves — never on every pass while it
 * lasts. The new state is saved BEFORE anyone is told, so a delivery that fails is not retried as a fresh
 * incident on the next pass. External providers are re-synced when the list of addresses or of providers
 * changes, and retried on the next pass when a sync fails.
 */
export class PlatformMonitorTask {
  static readonly NAME = 'platform-monitor';
  static readonly SCHEDULE = '*/5 * * * *';

  private readonly logger = new Logger({ namespace: 'platform-monitor' });
  private readonly store: MonitoringIncidentStore;
  private readonly providers: MonitoringProviderFactory;

  /** The monitor for this platform, reading every site with the platform-admin marker (no site is bound). */
  static for(manager: any): PlatformMonitorTask {
    const registry = new TenantRegistryService(manager.db, TenantResolverService.shared(manager.db));
    return new PlatformMonitorTask(manager, () => manager.db.withPlatformAdmin(() => registry.list()));
  }

  constructor(private readonly manager: any, private readonly sites: () => Promise<TenantRecord[]>) {
    this.store = new MonitoringIncidentStore(manager.db);
    this.providers = new MonitoringProviderFactory(manager);
  }

  async run(now: Date = new Date()): Promise<{ opened: IMonitoringIncident[]; resolved: IMonitoringIncident[] }> {
    const found = await new PlatformHealthChecks(this.manager, this.sites).run();
    const previous = await this.store.readOpen();
    const stamp = now.toISOString();
    const foundKeys = new Set(found.map((incident) => incident.key));
    const previousKeys = new Set(previous.map((incident) => incident.key));

    const opened = found.filter((incident) => !previousKeys.has(incident.key)).map((incident) => ({ ...incident, openedAt: stamp }));
    const resolved = previous.filter((incident) => !foundKeys.has(incident.key)).map((incident) => ({ ...incident, resolvedAt: stamp }));
    // Still open: keep when it started, refresh what was measured.
    const stillOpen = previous.filter((incident) => foundKeys.has(incident.key)).map((incident) => ({ ...incident, ...found.find((f) => f.key === incident.key)!, openedAt: incident.openedAt }));
    await this.store.writeOpen([...stillOpen, ...opened]);

    const active = await this.providers.active();
    for (const { key, provider } of active) {
      for (const incident of opened) await this.deliver(key, () => provider.notify?.(incident, MonitoringChange.OPENED));
      for (const incident of resolved) await this.deliver(key, () => provider.notify?.(incident, MonitoringChange.RESOLVED));
    }
    await this.syncTargets(active);
    return { opened, resolved };
  }

  /** What external providers should watch: every site visitors can read, and the platform's own health check. */
  async targets(): Promise<IMonitoringTarget[]> {
    const scheme = EnvUtils.isProduction() ? 'https' : 'http';
    const targets: IMonitoringTarget[] = [];
    for (const site of await this.sites()) {
      if (site.isWorkspace || !site.isReadable || !site.primaryHost) continue;
      targets.push({ key: site.id, label: site.slug, url: `${scheme}://${site.primaryHost}/` });
    }
    const adminUrl = String(await PlatformSettingsService.getSetting(SystemConstants.META_KEY.ADMIN_URL) ?? '');
    if (adminUrl) targets.push({ key: 'platform', label: 'platform', url: ApiPathUtils.absoluteUrl(adminUrl, ApiPathUtils.versioned(SystemApiPaths.ALL.SYSTEM.HEALTH)) });
    return targets.sort((a, b) => a.key.localeCompare(b.key));
  }

  private async syncTargets(active: Array<{ key: string; provider: { syncTargets?: (targets: IMonitoringTarget[]) => Promise<void> } }>): Promise<void> {
    const syncing = active.filter(({ provider }) => provider.syncTargets);
    if (!syncing.length) return;
    const targets = await this.targets();
    const fingerprint = JSON.stringify({ providers: syncing.map(({ key }) => key).sort(), targets });
    if (fingerprint === await this.store.readSyncedTargets()) return;
    let allSynced = true;
    for (const { key, provider } of syncing) {
      allSynced = (await this.deliver(key, () => provider.syncTargets!(targets))) && allSynced;
    }
    if (allSynced) await this.store.writeSyncedTargets(fingerprint);
  }

  /** One provider's failure never stops the others, and is logged with the provider's name. */
  private async deliver(key: string, send: () => Promise<void> | undefined): Promise<boolean> {
    try {
      await send();
      return true;
    } catch (error: any) {
      this.logger.warn(`Monitoring provider "${key}" failed: ${error?.message || error}`);
      return false;
    }
  }
}

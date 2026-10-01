import { HostResourceService } from '@core/management/host-resource-service';
import { PlatformSettingsService } from '@core/management/platform-settings-service';
import { SystemConstants } from '@core/constants/system.constants';
import { EnvUtils } from '@core/utils/env-utils';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';
import { MonitoringIncidentKind } from '@core/monitoring/enums/monitoring-incident-kind.enum';
import { ApiOutcomeCounter } from '@core/monitoring/api-outcome-counter';
import type { IMonitoringIncident } from '@core/monitoring/interfaces/monitoring-incident.interface';
import type { TenantRecord } from '@core/tenant/tenant-record';

/**
 * What is wrong with the platform right now, as incidents without timestamps (the monitor stamps them).
 *
 * Every threshold is a declared platform setting (Settings → Infrastructure → Monitoring); `0` switches
 * that check off. A check that cannot measure (no disk figure, no traffic) reports nothing rather than a
 * guess.
 */
export class PlatformHealthChecks {
  /** Fewer api requests than this since the last check is too few to call a share of them a trend. */
  private static readonly MIN_API_SAMPLE = 20;

  constructor(private readonly manager: any, private readonly sites: () => Promise<TenantRecord[]>) {}

  async run(): Promise<Array<Omit<IMonitoringIncident, 'openedAt'>>> {
    const found = [...this.plugins(), ...(await this.sitesDown())];
    const resources = await HostResourceService.read() as any;
    found.push(...this.share(MonitoringIncidentKind.DISK_FULL, resources?.disk?.usedBytes, resources?.disk?.totalBytes, await PlatformHealthChecks.threshold(SystemConstants.META_KEY.MONITORING_DISK_PERCENT)));
    found.push(...this.share(MonitoringIncidentKind.MEMORY_FULL, resources?.memory?.usedBytes, resources?.memory?.totalBytes, await PlatformHealthChecks.threshold(SystemConstants.META_KEY.MONITORING_MEMORY_PERCENT)));
    found.push(...(await this.apiErrors()));
    return found;
  }

  private plugins(): Array<Omit<IMonitoringIncident, 'openedAt'>> {
    const found: Array<Omit<IMonitoringIncident, 'openedAt'>> = [];
    for (const plugin of this.manager.plugins?.values?.() ?? []) {
      const slug = String(plugin?.manifest?.slug ?? '');
      const inError = PluginState.resolve(plugin?.state) === PluginState.ERROR;
      const held = Boolean(plugin?.heldReason);
      if (!slug || (!inError && !held)) continue;
      found.push({
        key: `${MonitoringIncidentKind.PLUGIN_UNHEALTHY.value}:${slug}`,
        kind: MonitoringIncidentKind.PLUGIN_UNHEALTHY.value,
        subject: slug,
        values: { reason: held ? String(plugin.heldReason?.value ?? plugin.heldReason) : PluginState.ERROR.value },
      });
    }
    return found;
  }

  private async sitesDown(): Promise<Array<Omit<IMonitoringIncident, 'openedAt'>>> {
    const scheme = EnvUtils.isProduction() ? 'https' : 'http';
    const found: Array<Omit<IMonitoringIncident, 'openedAt'>> = [];
    for (const site of await this.sites()) {
      if (site.isWorkspace || !site.isReadable || !site.primaryHost) continue;
      const url = `${scheme}://${site.primaryHost}/`;
      const problem = await PlatformHealthChecks.probe(url);
      if (!problem) continue;
      found.push({ key: `${MonitoringIncidentKind.SITE_DOWN.value}:${site.id}`, kind: MonitoringIncidentKind.SITE_DOWN.value, subject: site.slug, values: { url, ...problem } });
    }
    return found;
  }

  /**
   * What is wrong with a site's home page — the status it answered with, or why it did not answer — or
   * null when it answered. A 404 is an empty site, not a down one.
   */
  private static async probe(url: string): Promise<Record<string, string | number> | null> {
    try {
      const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15_000) });
      return response.status >= 500 ? { status: response.status } : null;
    } catch (error: any) {
      return { error: String(error?.cause?.code ?? error?.name ?? error?.message ?? '') };
    }
  }

  private share(kind: MonitoringIncidentKind, used: unknown, total: unknown, threshold: number): Array<Omit<IMonitoringIncident, 'openedAt'>> {
    const usedBytes = Number(used);
    const totalBytes = Number(total);
    if (!threshold || !Number.isFinite(usedBytes) || !totalBytes) return [];
    const percent = Math.round((usedBytes / totalBytes) * 100);
    if (percent < threshold) return [];
    const gib = (bytes: number) => (bytes / 1024 ** 3).toFixed(1);
    return [{ key: kind.value, kind: kind.value, values: { percent, threshold, usedGib: gib(usedBytes), totalGib: gib(totalBytes) } }];
  }

  private async apiErrors(): Promise<Array<Omit<IMonitoringIncident, 'openedAt'>>> {
    const { total, errors } = ApiOutcomeCounter.drain();
    const threshold = await PlatformHealthChecks.threshold(SystemConstants.META_KEY.MONITORING_API_ERROR_PERCENT);
    if (!threshold || total < PlatformHealthChecks.MIN_API_SAMPLE) return [];
    const percent = Math.round((errors / total) * 100);
    if (percent < threshold) return [];
    const kind = MonitoringIncidentKind.API_ERRORS;
    return [{ key: kind.value, kind: kind.value, values: { errors, total, percent, threshold } }];
  }

  private static async threshold(key: string): Promise<number> {
    const value = Number(await PlatformSettingsService.getSetting(key));
    return Number.isFinite(value) && value > 0 ? value : 0;
  }
}

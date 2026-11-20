import { PendingSave } from '@/lib/settings/pending-save';
import { PendingSaves } from '@/lib/settings/pending-saves';
import type { ReactNode } from 'react';
import { bound, state } from '@fromcode119/react-class-components';
import { SystemConstants } from '@fromcode119/core/client';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Card } from '@/components/ui/view/card.client';
import { NumberStepper } from '@/components/ui/number-stepper';
import { SettingRow } from '@/components/ui/view/setting-row.client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { AdminSystemSettingsClient } from '@/lib/settings/admin-system-settings-client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * WHERE plugin code runs, and what it may spend there.
 *
 * WHERE plugins run is stated, not chosen: every plugin runs in its own process, with no secrets,
 * site-bound calls, a heap ceiling and a per-request deadline — a plugin inside the api would hold
 * the api. Only the limits are the operator's: the heap and deadline for every plugin, and the share
 * of the machine a plugin a SITE uploaded may hold. Each field is empty until the platform sets a
 * value, and names the declared default it then resolves to.
 */
export class PluginIsolationCard extends AdminComponent {
  private static readonly LIMITS = [
    { key: SystemConstants.META_KEY.PLUGIN_ISOLATION_MEMORY_MB, title: () => AdminI18n.t('settings.infrastructure.memoryCeilingPerPluginProcess'), description: () => AdminI18n.t('settings.infrastructure.aPluginThatAllocatesPast'), min: 64, step: 64, fallback: SystemConstants.PLUGIN_ISOLATION_MEMORY_MB_DEFAULT },
    { key: SystemConstants.META_KEY.PLUGIN_ISOLATION_TIMEOUT_MS, title: () => AdminI18n.t('settings.infrastructure.deadlinePerRequestMs'), description: () => AdminI18n.t('settings.infrastructure.aPluginRouteOrHook'), min: 1000, step: 1000, fallback: SystemConstants.PLUGIN_ISOLATION_TIMEOUT_MS_DEFAULT },
    { key: SystemConstants.META_KEY.PLUGIN_ISOLATION_SITE_CPU_PERCENT, title: () => AdminI18n.t('settings.infrastructure.siteUploadedPluginCpuShare'), description: () => AdminI18n.t('settings.infrastructure.siteUploadedPluginCpuShareDescription'), min: 10, max: 100, step: 10, fallback: SystemConstants.PLUGIN_ISOLATION_SITE_CPU_PERCENT_DEFAULT },
    { key: SystemConstants.META_KEY.PLUGIN_ISOLATION_SITE_MEMORY_MB, title: () => AdminI18n.t('settings.infrastructure.siteUploadedPluginMemory'), description: () => AdminI18n.t('settings.infrastructure.siteUploadedPluginMemoryDescription'), min: 64, step: 64, fallback: SystemConstants.PLUGIN_ISOLATION_SITE_MEMORY_MB_DEFAULT },
    { key: SystemConstants.META_KEY.PLUGIN_ISOLATION_SITE_DISK_MB, title: () => AdminI18n.t('settings.infrastructure.siteUploadedPluginDisk'), description: () => AdminI18n.t('settings.infrastructure.siteUploadedPluginDiskDescription'), min: 1, step: 10, fallback: SystemConstants.PLUGIN_ISOLATION_SITE_DISK_MB_DEFAULT },
    { key: SystemConstants.META_KEY.PLUGIN_ISOLATION_SITE_MAX_TASKS, title: () => AdminI18n.t('settings.infrastructure.siteUploadedPluginProcesses'), description: () => AdminI18n.t('settings.infrastructure.siteUploadedPluginProcessesDescription'), min: 16, step: 8, fallback: SystemConstants.PLUGIN_ISOLATION_SITE_MAX_TASKS_DEFAULT },
  ] as const;

  @state values: Record<string, string> = {};
  @state saving = false;

  /** What the page's one save bar reads and writes for this card; made once the card is mounted. */
  private pending: PendingSave | null = null;

  async componentDidMount(): Promise<void> {
    this.pending = new PendingSave(
      () => ({ values: this.values }),
      () => this.save(),
      (values) => { this.values = values.values; },
    );
    try {
      const settings = await AdminSystemSettingsClient.getAll();
      this.values = Object.fromEntries(PluginIsolationCard.LIMITS.map((limit) => [limit.key, String(settings?.[limit.key] ?? '')]));
      this.pending?.mark();
    } catch (err: any) {
      this.runtime.notify.notify(NotificationType.ERROR, AdminI18n.t('settings.infrastructure.error'), err?.message || AdminI18n.t('settings.infrastructure.failedToSaveThePlugin'));
    }
  }

  private onChange(key: string): (value: number | string) => void {
    return (value) => { this.values = { ...this.values, [key]: String(value) }; };
  }

  @bound
  async save(): Promise<void> {
    this.saving = true;
    try {
      await AdminSystemSettingsClient.update(Object.fromEntries(PluginIsolationCard.LIMITS.map((limit) => [limit.key, this.values[limit.key] ?? ''])));
      // Limits reach every running plugin on save: a new deadline at its next call, a new heap ceiling
      // or share of the machine by restarting that plugin's own process.
      this.runtime.notify.notify(NotificationType.INFO, AdminI18n.t('settings.infrastructure.systemUpdated'), AdminI18n.t('settings.infrastructure.pluginIsolationSettingsSavedAnd'));
    } catch (err: any) {
      this.pending?.failed();
      this.runtime.notify.notify(NotificationType.ERROR, AdminI18n.t('settings.infrastructure.error'), err?.message || AdminI18n.t('settings.infrastructure.failedToSaveThePlugin'));
    } finally {
      this.saving = false;
    }
  }

  componentDidUpdate(): void {
    PendingSaves.changed();
  }

  componentWillUnmount(): void {
    this.pending?.dispose();
  }

  render(): ReactNode {
    const theme = this.theme;
    const last = PluginIsolationCard.LIMITS.length - 1;
    return (
      <Card title={AdminI18n.t('settings.infrastructure.pluginIsolation')}>
        <SettingRow theme={theme} title={AdminI18n.t('settings.infrastructure.wherePluginsRun')} stacked description={AdminI18n.t('settings.infrastructure.isolatedEachActivePluginRuns')}>
          <p className="text-xs fc-tone-muted">{AdminI18n.t('settings.infrastructure.everyPluginRunsIsolated')}</p>
        </SettingRow>
        {PluginIsolationCard.LIMITS.map((limit, index) => (
          <SettingRow key={limit.key} theme={theme} title={limit.title()} stacked description={limit.description()}>
            <div className="fc-settings-group">
              <div className="fc-settings-short fc-settings-short--narrow">
                <NumberStepper min={limit.min} max={'max' in limit ? limit.max : undefined} step={limit.step} value={this.values[limit.key] ?? ''} onChange={this.onChange(limit.key)} placeholder={AdminI18n.t('settings.infrastructure.defaultValue', { value: limit.fallback })} />
              </div>
            </div>
          </SettingRow>
        ))}
      </Card>
    );
  }
}

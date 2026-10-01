import type { ReactNode } from 'react';
import { bound, state } from '@fromcode119/react-class-components';
import { SystemConstants } from '@fromcode119/core/client';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Card } from '@/components/ui/view/card.client';
import { NumberStepper } from '@/components/ui/number-stepper';
import { Button } from '@/components/ui/view/button.client';
import { SettingRow } from '@/app/settings/general/setting-row';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { AdminSystemSettingsClient } from '@/lib/settings/admin-system-settings-client';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminApi } from '@/lib/api';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The platform monitor (Settings → Infrastructure). What it found open right now, where its alerts go,
 * which addresses the outside providers watch, and the three thresholds — each the stored platform
 * setting, shown as saved (the declared defaults until changed); 0 switches that check off.
 *
 * Where the alerts go is chosen in Settings → Integrations → Monitoring; this card only shows it.
 */
export class MonitoringCard extends AdminComponent {
  private static readonly THRESHOLDS = [
    { key: SystemConstants.META_KEY.MONITORING_DISK_PERCENT, label: 'settings.infrastructure.monitoringDisk' },
    { key: SystemConstants.META_KEY.MONITORING_MEMORY_PERCENT, label: 'settings.infrastructure.monitoringMemory' },
    { key: SystemConstants.META_KEY.MONITORING_API_ERROR_PERCENT, label: 'settings.infrastructure.monitoringApiErrors' },
  ];

  /** The translation key for each incident kind (the monitor stores kinds, never sentences). */
  private static readonly KIND_KEYS: Record<string, string> = {
    'plugin-unhealthy': 'settings.infrastructure.monitoringKindPluginUnhealthy',
    'site-down': 'settings.infrastructure.monitoringKindSiteDown',
    'disk-full': 'settings.infrastructure.monitoringKindDiskFull',
    'memory-full': 'settings.infrastructure.monitoringKindMemoryFull',
    'api-errors': 'settings.infrastructure.monitoringKindApiErrors',
  };

  @state thresholds: Record<string, string> = {};
  @state status: { incidents: any[]; providers: string[]; targets: Array<{ url: string }> } | null = null;
  @state loaded = false;
  @state saving = false;
  @state checking = false;

  async componentDidMount(): Promise<void> {
    try {
      const [settings, status] = await Promise.all([AdminSystemSettingsClient.getAll(), AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.MONITORING)]);
      this.thresholds = Object.fromEntries(MonitoringCard.THRESHOLDS.map(({ key }) => [key, String(settings?.[key] ?? '')]));
      this.status = status;
      this.loaded = true;
    } catch (err: any) {
      this.runtime.notify.notify(NotificationType.ERROR, AdminI18n.t('settings.infrastructure.monitoringUnavailable'), err?.message || '');
    }
  }

  @bound onThreshold(key: string, value: number | string): void { this.thresholds = { ...this.thresholds, [key]: String(value) }; }

  @bound
  async save(): Promise<void> {
    this.saving = true;
    try {
      await AdminSystemSettingsClient.update(this.thresholds);
      this.runtime.notify.notify(NotificationType.SUCCESS, AdminI18n.t('settings.infrastructure.saved'), AdminI18n.t('settings.infrastructure.monitoringSaved'));
    } catch (err: any) {
      this.runtime.notify.notify(NotificationType.ERROR, AdminI18n.t('settings.infrastructure.notSaved'), err?.message || '');
    } finally {
      this.saving = false;
    }
  }

  @bound
  async checkNow(): Promise<void> {
    this.checking = true;
    try {
      this.status = await AdminApi.post(AdminConstants.ENDPOINTS.SYSTEM.MONITORING_CHECK, {});
      this.runtime.notify.notify(NotificationType.SUCCESS, AdminI18n.t('settings.infrastructure.monitoringChecked'), AdminI18n.t('settings.infrastructure.monitoringOpenCount', { count: this.status?.incidents?.length ?? 0 }));
    } catch (err: any) {
      this.runtime.notify.notify(NotificationType.ERROR, AdminI18n.t('settings.infrastructure.monitoringCheckFailed'), err?.message || '');
    } finally {
      this.checking = false;
    }
  }

  private incidentLine(incident: any): string {
    const key = MonitoringCard.KIND_KEYS[String(incident?.kind ?? '')];
    return key ? AdminI18n.t(key, { subject: incident.subject ?? '', ...incident.values }) : String(incident?.kind ?? '');
  }

  private renderIncidents(): ReactNode {
    const incidents = this.status?.incidents ?? [];
    if (!incidents.length) return <p className="text-sm text-slate-500">{AdminI18n.t('settings.infrastructure.monitoringNoIncidents')}</p>;
    return (
      <ul className="space-y-2">
        {incidents.map((incident) => (
          <li key={incident.key} className="flex items-start gap-2 text-sm">
            <FrameworkIcons.Warning size={14} className="mt-0.5 shrink-0 text-amber-500" />
            <span>
              <span className="font-medium">{this.incidentLine(incident)}</span>
              <span className="block text-xs text-slate-500">{AdminI18n.t('settings.infrastructure.monitoringSince', { time: new Date(incident.openedAt).toLocaleString() })}</span>
            </span>
          </li>
        ))}
      </ul>
    );
  }

  render(): ReactNode {
    const providers = (this.status?.providers ?? []).join(', ');
    const watched = (this.status?.targets ?? []).map((target) => target.url).join(', ');
    return (
      <Card title={AdminI18n.t('settings.infrastructure.monitoring')}>
        <SettingRow theme={this.theme} icon={FrameworkIcons.Activity} title={AdminI18n.t('settings.infrastructure.monitoringOpenIncidents')} stacked description={AdminI18n.t('settings.infrastructure.monitoringHelp')}>
          <div className="space-y-3">
            {this.renderIncidents()}
            <Button onClick={this.checkNow} isLoading={this.checking} disabled={!this.loaded} icon={<FrameworkIcons.Refresh size={13} />} className="h-10 px-4 rounded-xl text-[11px] font-bold uppercase tracking-tight">
              {AdminI18n.t('settings.infrastructure.monitoringCheckNow')}
            </Button>
          </div>
        </SettingRow>
        <SettingRow theme={this.theme} icon={FrameworkIcons.Bell} title={AdminI18n.t('settings.infrastructure.monitoringProviders')} stacked description={AdminI18n.t('settings.infrastructure.monitoringProvidersHelp')}>
          <p className="text-sm">{providers || AdminI18n.t('settings.infrastructure.monitoringNoProviders')}</p>
          <p className="mt-1 text-xs text-slate-500">{watched ? AdminI18n.t('settings.infrastructure.monitoringWatched', { addresses: watched }) : AdminI18n.t('settings.infrastructure.monitoringNothingWatched')}</p>
        </SettingRow>
        {MonitoringCard.THRESHOLDS.map(({ key, label }) => (
          <SettingRow key={key} theme={this.theme} icon={FrameworkIcons.Server} title={AdminI18n.t(label)} stacked description={AdminI18n.t('settings.infrastructure.monitoringThresholdHelp')}>
            <div className="w-full md:w-40">
              <NumberStepper min={0} max={100} step={1} value={this.thresholds[key] ?? ''} onChange={(value: number | string) => this.onThreshold(key, value)} disabled={!this.loaded} />
            </div>
          </SettingRow>
        ))}
        <div className="flex justify-end pt-2">
          <Button onClick={this.save} isLoading={this.saving} disabled={!this.loaded} icon={<FrameworkIcons.Save size={13} />} className="h-10 px-4 rounded-xl text-[11px] font-bold uppercase tracking-tight">
            {AdminI18n.t('settings.infrastructure.save')}
          </Button>
        </div>
      </Card>
    );
  }
}

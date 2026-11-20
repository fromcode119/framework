import { PendingSave } from '@/lib/settings/pending-save';
import { PendingSaves } from '@/lib/settings/pending-saves';
import type { ReactNode } from 'react';
import { bound, state } from '@fromcode119/react-class-components';
import { SystemConstants } from '@fromcode119/core/client';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Card } from '@/components/ui/view/card.client';
import { NumberStepper } from '@/components/ui/number-stepper';
import { Button } from '@/components/ui/view/button.client';
import { SettingRow } from '@/components/ui/view/setting-row.client';
import { SettingRowWidth } from '@/components/ui/enums/setting-row-width.enum';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { Hint } from '@/components/ui/view/hint.client';
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
  @state status: { incidents: any[]; providers: string[]; alerting?: boolean; platformMail?: boolean; emailRecipients?: string[]; targets: Array<{ url: string }> } | null = null;
  @state loaded = false;
  @state saving = false;

  /** What the page's one save bar reads and writes for this card; made once the card is mounted. */
  private pending: PendingSave | null = null;
  @state checking = false;

  async componentDidMount(): Promise<void> {
    this.pending = new PendingSave(
      () => ({ thresholds: this.thresholds }),
      () => this.save(),
      (values) => { this.thresholds = values.thresholds; },
    );
    try {
      const [settings, status] = await Promise.all([AdminSystemSettingsClient.getAll(), AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.MONITORING)]);
      this.thresholds = Object.fromEntries(MonitoringCard.THRESHOLDS.map(({ key }) => [key, String(settings?.[key] ?? '')]));
      this.status = status;
      this.loaded = true;
      this.pending?.mark();
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
      this.pending?.failed();
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

  /** Each open problem as a warning line, with when it started and, for API errors, the routes. */
  private renderIncidents(): ReactNode[] {
    return (this.status?.incidents ?? []).map((incident) => (
      <Hint key={incident.key} variant="warning">
        {this.incidentLine(incident)}
        {incident.values?.routes ? <span className="fc-hint__more">{AdminI18n.t('settings.infrastructure.monitoringFailingRoutes', { routes: incident.values.routes })}</span> : null}
        <span className="fc-hint__more">{AdminI18n.t('settings.infrastructure.monitoringSince', { time: new Date(incident.openedAt).toLocaleString() })}</span>
      </Hint>
    ));
  }

  /** Who gets the e-mail, and what stops an alert from leaving at all. */
  private renderDelivery(): ReactNode[] {
    const status = this.status;
    const lines: ReactNode[] = [];
    if (status?.providers?.includes('email')) {
      const addresses = (status.emailRecipients ?? []).join(', ');
      lines.push(addresses
        ? <Hint key="to">{AdminI18n.t('settings.infrastructure.monitoringEmailRecipients', { addresses })}</Hint>
        : <Hint key="to" variant="warning">{AdminI18n.t('settings.infrastructure.monitoringNoEmailRecipients')}</Hint>);
      if (status.platformMail === false) lines.push(<Hint key="mail" variant="warning">{AdminI18n.t('settings.infrastructure.monitoringNoPlatformMail')}</Hint>);
    }
    if (status?.providers?.length && status.alerting === false) lines.push(<Hint key="off" variant="warning">{AdminI18n.t('settings.infrastructure.monitoringNoAlerting')}</Hint>);
    const watched = (status?.targets ?? []).map((target) => target.url).join(', ');
    lines.push(<Hint key="watched">{watched ? AdminI18n.t('settings.infrastructure.monitoringWatched', { addresses: watched }) : AdminI18n.t('settings.infrastructure.monitoringNothingWatched')}</Hint>);
    return lines;
  }

  componentDidUpdate(): void {
    PendingSaves.changed();
  }

  componentWillUnmount(): void {
    this.pending?.dispose();
  }

  render(): ReactNode {
    const providers = (this.status?.providers ?? []).join(', ');
    const incidents = this.renderIncidents();
    return (
      <Card title={AdminI18n.t('settings.infrastructure.monitoring')}>
        <SettingRow theme={this.theme} title={AdminI18n.t('settings.infrastructure.monitoringOpenIncidents')} description={AdminI18n.t('settings.infrastructure.monitoringHelp')} width={SettingRowWidth.AUTO}>
          <div className="fc-settings-group">
            <Button variant={ButtonVariant.SECONDARY} onClick={this.checkNow} isLoading={this.checking} disabled={!this.loaded} icon={<FrameworkIcons.Refresh size={13} />}>
              {AdminI18n.t('settings.infrastructure.monitoringCheckNow')}
            </Button>
          </div>
        </SettingRow>
        <div className="fc-settings-note">
          {incidents.length ? incidents : <Hint variant="success">{AdminI18n.t('settings.infrastructure.monitoringNoIncidents')}</Hint>}
        </div>
        <SettingRow theme={this.theme} title={AdminI18n.t('settings.infrastructure.monitoringProviders')} description={AdminI18n.t('settings.infrastructure.monitoringProvidersHelp')} width={SettingRowWidth.AUTO}>
          <span className={`fc-settings-value${providers ? '' : ' fc-settings-value--empty'}`}>{providers || AdminI18n.t('settings.infrastructure.monitoringNoProviders')}</span>
        </SettingRow>
        <div className="fc-settings-note">{this.renderDelivery()}</div>
        {MonitoringCard.THRESHOLDS.map(({ key, label }) => (
          <SettingRow key={key} theme={this.theme} title={AdminI18n.t(label)} description={AdminI18n.t('settings.infrastructure.monitoringThresholdHelp')} width={SettingRowWidth.NARROW}>
            <NumberStepper min={0} max={100} step={1} value={this.thresholds[key] ?? ''} onChange={(value: number | string) => this.onThreshold(key, value)} disabled={!this.loaded} />
          </SettingRow>
        ))}
      </Card>
    );
  }
}

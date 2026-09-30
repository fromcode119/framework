import type { ReactNode } from 'react';
import { bound, state } from '@fromcode119/react-class-components';
import { SystemConstants } from '@fromcode119/core/client';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Card } from '@/components/ui/view/card.client';
import { Button } from '@/components/ui/view/button.client';
import { Switch } from '@/components/ui/view/switch.client';
import { SettingRow } from '@/app/settings/general/setting-row';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { AdminSystemSettingsClient } from '@/lib/settings/admin-system-settings-client';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { SiteClock } from '@/lib/site-clock';

/**
 * The platform's IP-location database: the switch, what is actually on disk, and the credit DB-IP's
 * licence requires.
 *
 * The switch is the `geo_ip_lookup` platform setting. Saving it asks the server to bring the file in
 * line straight away (install on, remove off), and the card then shows the server's answer — never a
 * state it assumed.
 */
export class GeoLocationCard extends AdminComponent {
  @state enabled = false;
  @state status: Record<string, any> | null = null;
  @state loaded = false;
  @state busy = false;

  async componentDidMount(): Promise<void> {
    try {
      this.status = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.GEO);
      this.enabled = Boolean(this.status?.enabled);
      this.loaded = true;
    } catch (err: any) {
      this.runtime.notify.notify(NotificationType.ERROR, AdminI18n.t('settings.infrastructure.geoUnavailable'), err?.message || '');
    }
  }

  @bound
  async onToggle(value: boolean): Promise<void> {
    this.busy = true;
    try {
      await AdminSystemSettingsClient.update({ [SystemConstants.META_KEY.GEO_IP_LOOKUP]: value ? 'true' : 'false' });
      this.enabled = value;
      this.runtime.notify.notify(NotificationType.SUCCESS, AdminI18n.t('settings.infrastructure.geoSaved'), AdminI18n.t(value ? 'settings.infrastructure.geoSavedOn' : 'settings.infrastructure.geoSavedOff'));
      this.status = await AdminApi.post(AdminConstants.ENDPOINTS.SYSTEM.GEO_UPDATE, {});
      this.enabled = Boolean(this.status?.enabled);
    } catch (err: any) {
      this.runtime.notify.notify(NotificationType.ERROR, AdminI18n.t('settings.infrastructure.geoUpdateFailed'), err?.message || '');
    } finally {
      this.busy = false;
    }
  }

  @bound
  async updateNow(): Promise<void> {
    this.busy = true;
    try {
      this.status = await AdminApi.post(AdminConstants.ENDPOINTS.SYSTEM.GEO_UPDATE, {});
      const failed = Boolean(this.status?.lastError);
      this.runtime.notify.notify(
        failed ? NotificationType.ERROR : NotificationType.SUCCESS,
        AdminI18n.t(failed ? 'settings.infrastructure.geoUpdateFailed' : 'settings.infrastructure.geoUpdated'),
        failed ? String(this.status?.lastError) : '',
      );
    } catch (err: any) {
      this.runtime.notify.notify(NotificationType.ERROR, AdminI18n.t('settings.infrastructure.geoUpdateFailed'), err?.message || '');
    } finally {
      this.busy = false;
    }
  }

  private static when(iso: unknown): string {
    const date = new Date(String(iso || ''));
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short', hourCycle: SiteClock.hourCycle() });
  }

  private databaseLine(): string {
    const status = this.status;
    if (!status?.edition) return AdminI18n.t('settings.infrastructure.geoDatabaseNone');
    return AdminI18n.t('settings.infrastructure.geoDatabaseInstalled', {
      edition: status.edition,
      size: String(Math.round((Number(status.sizeBytes) / (1024 * 1024)) * 10) / 10),
      installedAt: GeoLocationCard.when(status.installedAt),
    });
  }

  render(): ReactNode {
    const theme = this.theme;
    const status = this.status;
    const source = status?.source;
    return (
      <Card title={AdminI18n.t('settings.infrastructure.geoLocation')}>
        <SettingRow theme={theme} icon={FrameworkIcons.Globe} title={AdminI18n.t('settings.infrastructure.geoLookupTitle')} stacked description={AdminI18n.t('settings.infrastructure.geoLookupDescription')}>
          <Switch checked={this.enabled} onChange={this.onToggle} disabled={!this.loaded || this.busy} label={this.enabled ? AdminI18n.t('settings.infrastructure.on') : AdminI18n.t('settings.infrastructure.off')} />
        </SettingRow>
        <SettingRow theme={theme} icon={FrameworkIcons.Database} title={AdminI18n.t('settings.infrastructure.geoDatabaseTitle')} stacked description={this.databaseLine()}>
          <div className="flex flex-col gap-2">
            {status?.lastCheckedAt ? <span className="text-xs text-slate-500">{AdminI18n.t('settings.infrastructure.geoLastChecked', { lastCheckedAt: GeoLocationCard.when(status.lastCheckedAt) })}</span> : null}
            {status?.lastError ? <span className="text-xs text-rose-500">{AdminI18n.t('settings.infrastructure.geoLastError', { error: String(status.lastError) })}</span> : null}
            <Button onClick={this.updateNow} isLoading={this.busy} disabled={!this.loaded || !this.enabled} icon={<FrameworkIcons.Refresh size={13} />} className="h-10 px-4 rounded-xl text-[11px] font-bold uppercase tracking-tight self-start">
              {AdminI18n.t('settings.infrastructure.geoUpdateNow')}
            </Button>
          </div>
        </SettingRow>
        {source ? (
          <p className="px-1 pt-2 text-xs text-slate-500">
            <a href={source.url} target="_blank" rel="noreferrer" className="underline">{AdminI18n.t('settings.infrastructure.geoAttribution', { name: source.name, license: source.license })}</a>
          </p>
        ) : null}
      </Card>
    );
  }
}

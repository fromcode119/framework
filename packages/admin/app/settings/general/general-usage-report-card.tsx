import { UsageReportDefaults } from '@fromcode119/core/client';
import type { ChangeEvent, Dispatch, ReactNode, SetStateAction } from 'react';
import { prop, state, bound } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Card } from '@/components/ui/view/card.client';
import { Button } from '@/components/ui/view/button.client';
import { Input } from '@/components/ui/view/input.client';
import { Switch } from '@/components/ui/view/switch.client';
import { Explanation } from '@/components/ui/view/explanation.client';
import { SettingRow } from '@/app/settings/general/setting-row';
import { AdminRichText } from '@/components/ui/view/admin-rich-text.client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import type { PlatformSettingLocks } from '@/lib/settings/platform-setting-locks';
import type { UsageReportView } from '@/app/settings/general/interfaces/usage-report-view.interface';

/**
 * Settings → General → Usage report. Off unless the operator turns it on. Beside the switch: the exact
 * report the api would send (the same object it sends, read from the api, not rebuilt here), where it
 * goes, and how the last send went. Platform-only, like the report itself.
 */
export class GeneralUsageReportCard extends AdminComponent {
  @prop declare platformLocks: PlatformSettingLocks;
  @prop declare settings: Record<string, any>;
  @prop declare setSettings: Dispatch<SetStateAction<Record<string, any>>>;

  @state preview: UsageReportView | null = null;
  @state loadError: string | null = null;
  @state isSending = false;

  async componentDidMount(): Promise<void> {
    if (this.platformLocks.shown('usage_report_enabled')) await this.load();
  }

  private async load(): Promise<void> {
    try {
      this.preview = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.USAGE_REPORT, { noDedupe: true });
      this.loadError = null;
    } catch (err: any) {
      this.loadError = err?.message || AdminI18n.t('settings.general.usageReportLoadFailed');
    }
  }

  @bound
  protected changeEnabled(value: boolean): void {
    this.setSettings((prev) => ({ ...prev, usage_report_enabled: value }));
  }

  @bound
  protected changeAddress(e: ChangeEvent<HTMLInputElement>): void {
    const usage_report_url = e.target.value;
    this.setSettings((prev) => ({ ...prev, usage_report_url }));
  }

  @bound
  async sendNow(): Promise<void> {
    const addNotification = this.runtime.notify.addNotification;
    this.isSending = true;
    try {
      const result = await AdminApi.post(AdminConstants.ENDPOINTS.SYSTEM.USAGE_REPORT_SEND, {});
      addNotification({ title: AdminI18n.t('settings.general.usageReportSent'), message: String(result?.status?.message ?? ''), type: NotificationType.SUCCESS });
    } catch (err: any) {
      addNotification({ title: AdminI18n.t('settings.general.usageReportSendFailed'), message: err?.message || '', type: NotificationType.ERROR });
    } finally {
      this.isSending = false;
      await this.load();
    }
  }

  private renderStatus(): ReactNode {
    const status = this.preview?.status;
    if (!status) return <p className="text-xs opacity-70">{AdminI18n.t('settings.general.usageReportNeverSent')}</p>;
    const when = new Date(status.at).toLocaleString();
    return (
      <p className={`text-xs font-semibold ${status.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
        {AdminI18n.t(status.ok ? 'settings.general.usageReportLastOk' : 'settings.general.usageReportLastFailed', { when, message: status.message })}
      </p>
    );
  }

  render(): ReactNode {
    const { settings, theme, platformLocks } = this;
    if (!platformLocks.shown('usage_report_enabled')) return null;
    return (
      <Card title={AdminI18n.t('settings.general.usageReport')}>
        <SettingRow
          theme={theme}
          icon={FrameworkIcons.Activity}
          title={AdminI18n.t('settings.general.usageReportSend')}
          description={<AdminRichText k="settings.general.usageReportSendDescription" />}
          explanation={(
            <Explanation>
              <p><AdminRichText k="settings.general.usageReportNeverIncludes" /></p>
              <p>{AdminI18n.t('settings.general.usageReportAnonymous')}</p>
            </Explanation>
          )}
        >
          <div className="flex items-center gap-3">
            <Switch checked={settings.usage_report_enabled === true} onChange={this.changeEnabled} />
            <Button
              onClick={this.sendNow}
              isLoading={this.isSending}
              icon={<FrameworkIcons.Send size={13} />}
              className="h-10 px-4 rounded-xl text-[12px] font-medium tracking-tight"
            >
              {AdminI18n.t('settings.general.usageReportSendNow')}
            </Button>
          </div>
        </SettingRow>

        {platformLocks.shown('usage_report_url') && (
          <SettingRow
            theme={theme}
            icon={FrameworkIcons.Globe}
            title={AdminI18n.t('settings.general.usageReportAddress')}
            description={<AdminRichText k="settings.general.usageReportAddressDescription" vars={{ address: UsageReportDefaults.ADDRESS }} />}
          >
            <Input value={settings.usage_report_url} onChange={this.changeAddress} className="w-full md:w-80 font-bold" placeholder={UsageReportDefaults.ADDRESS} />
          </SettingRow>
        )}

        <SettingRow
          theme={theme}
          icon={FrameworkIcons.Eye}
          title={AdminI18n.t('settings.general.usageReportContents')}
          description={this.preview
            ? <AdminRichText k="settings.general.usageReportContentsDescription" vars={{ target: this.preview.target }} />
            : (this.loadError || AdminI18n.t('settings.general.usageReportLoading'))}
          stacked
        >
          <div className="flex flex-col gap-2 w-full min-w-0">
            {this.preview && (
              <pre className="text-[11px] leading-relaxed font-mono rounded-xl p-3 overflow-x-auto bg-black/5 dark:bg-white/5 max-h-72">
                {JSON.stringify(this.preview.report, null, 2)}
              </pre>
            )}
            {this.preview && this.renderStatus()}
          </div>
        </SettingRow>
      </Card>
    );
  }
}

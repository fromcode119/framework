import type { ReactNode } from 'react';
import { bound, state } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Button } from '@/components/ui/view/button.client';
import { NumberStepper } from '@/components/ui/number-stepper';
import { SettingRow } from '@/app/settings/general/setting-row';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { AdminSystemSettingsClient } from '@/lib/settings/admin-system-settings-client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * How long the Jobs page's run history is kept (`job_run_retention_days`). Blank or 0 keeps every run
 * — the platform prunes only what this field asks for, the same rule as the system log above it.
 */
export class JobRunRetentionRow extends AdminComponent {
  @state private days = '';
  @state private saving = false;

  async componentDidMount(): Promise<void> {
    try {
      const settings = await AdminSystemSettingsClient.getAll();
      this.days = String(settings?.job_run_retention_days ?? '');
    } catch {
      // The card above reports an unreadable settings store; this row stays blank rather than guess.
    }
  }

  @bound private onChange(value: number | string): void {
    this.days = String(value);
  }

  @bound private async save(): Promise<void> {
    const addNotification = this.runtime.notify.addNotification;
    this.saving = true;
    try {
      await AdminSystemSettingsClient.update({ job_run_retention_days: this.days });
      const days = Number(this.days);
      addNotification({
        title: AdminI18n.t('settings.infrastructure.systemUpdated'),
        message: days > 0 ? AdminI18n.t('settings.infrastructure.jobRunsOlderThanDay', { days }) : AdminI18n.t('settings.infrastructure.jobRunsAreKeptForever'),
        type: NotificationType.INFO,
      });
    } catch (err: any) {
      addNotification({ title: AdminI18n.t('settings.infrastructure.error'), message: err?.message || AdminI18n.t('settings.infrastructure.failedToSaveJobRunRetention'), type: NotificationType.ERROR });
    } finally {
      this.saving = false;
    }
  }

  render(): ReactNode {
    return (
      <SettingRow
        theme={this.theme}
        icon={FrameworkIcons.Clock}
        title={AdminI18n.t('settings.infrastructure.jobRunRetention')}
        stacked
        description={AdminI18n.t('settings.infrastructure.daysOfJobRunHistory')}
      >
        <div className="flex items-center gap-3">
          <div className="w-full md:w-40">
            <NumberStepper min={0} step={1} value={this.days} onChange={this.onChange} placeholder={AdminI18n.t('settings.infrastructure.keepForever')} />
          </div>
          <Button onClick={this.save} isLoading={this.saving} icon={<FrameworkIcons.Save size={13} />} className="h-10 px-4 rounded-xl text-[11px] font-bold uppercase tracking-tight">
            {AdminI18n.t('settings.infrastructure.save')}
          </Button>
        </div>
      </SettingRow>
    );
  }
}

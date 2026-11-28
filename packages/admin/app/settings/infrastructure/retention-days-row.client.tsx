import { PendingSave } from '@/lib/settings/pending-save';
import { PendingSaves } from '@/lib/settings/pending-saves';
import type { ReactNode } from 'react';
import { bound, prop, state } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';
import { NumberStepper } from '@/components/ui/number-stepper';
import { SettingRow } from '@/components/ui/view/setting-row.client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { AdminSystemSettingsClient } from '@/lib/settings/admin-system-settings-client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * How many days one journal keeps (`job_run_retention_days`, `email_log_retention_days`, …). Blank or 0
 * keeps everything — the platform prunes only what this field asks for, the same rule as the system log.
 * One row for every window, so each journal's field reads, saves and reports the same way.
 */
export class RetentionDaysRow extends AdminComponent {
  /** The declared setting this row edits. */
  @prop declare settingKey: string;
  @prop declare title: string;
  @prop declare description: string;
  /** What saving a window of `days` will do, said after the save. */
  @prop declare olderThan: (days: number) => string;
  @prop declare keptForever: string;
  @prop declare failed: string;

  @state private days = '';
  @state private saving = false;

  /** What the page's one save bar reads and writes for this card; made once the card is mounted. */
  private pending: PendingSave | null = null;

  async componentDidMount(): Promise<void> {
    this.pending = new PendingSave(
      () => ({ days: this.days }),
      () => this.save(),
      (values) => { this.days = values.days; },
    );
    try {
      const settings = await AdminSystemSettingsClient.getAll();
      this.days = String(settings?.[this.settingKey] ?? '');
      this.pending?.mark();
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
      await AdminSystemSettingsClient.update({ [this.settingKey]: this.days });
      const days = Number(this.days);
      addNotification({
        title: AdminI18n.t('settings.infrastructure.systemUpdated'),
        message: days > 0 ? this.olderThan(days) : this.keptForever,
        type: NotificationType.INFO,
      });
    } catch (err: any) {
      this.pending?.failed();
      addNotification({ title: AdminI18n.t('settings.infrastructure.error'), message: err?.message || this.failed, type: NotificationType.ERROR });
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
    return (
      <SettingRow
        theme={this.theme}
        title={this.title}
        stacked
        description={this.description}
      >
        <div className="fc-settings-group">
          <div className="fc-settings-short fc-settings-short--narrow">
            <NumberStepper min={0} step={1} value={this.days} onChange={this.onChange} placeholder={AdminI18n.t('settings.infrastructure.keepForever')} />
          </div>
        </div>
      </SettingRow>
    );
  }
}

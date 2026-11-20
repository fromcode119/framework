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
 * How many database connections the api holds at once for the requests it serves (DatabasePoolRegistry).
 *
 * Every site shares them; when all are in use a request waits, which is what the api log's
 * "Requests have waited over 2 s for a database connection" warns about. The field shows the stored
 * value — the declared default of 20 until the operator saves one — and a save applies at once.
 */
export class DatabasePoolCard extends AdminComponent {
  @state max = '';
  @state loaded = false;
  @state saving = false;

  /** What the page's one save bar reads and writes for this card; made once the card is mounted. */
  private pending: PendingSave | null = null;

  async componentDidMount(): Promise<void> {
    this.pending = new PendingSave(
      () => ({ max: this.max }),
      () => this.save(),
      (values) => { this.max = values.max; },
    );
    try {
      const settings = await AdminSystemSettingsClient.getAll();
      this.max = String(settings?.[SystemConstants.META_KEY.DATABASE_POOL_MAX] ?? '');
      this.loaded = true;
      this.pending?.mark();
    } catch (err: any) {
      this.runtime.notify.notify(NotificationType.ERROR, AdminI18n.t('settings.infrastructure.databasePoolUnavailable'), err?.message || '');
    }
  }

  @bound onMax(value: number | string): void { this.max = String(value); }

  @bound
  async save(): Promise<void> {
    this.saving = true;
    try {
      await AdminSystemSettingsClient.update({ [SystemConstants.META_KEY.DATABASE_POOL_MAX]: this.max });
      this.runtime.notify.notify(NotificationType.SUCCESS, AdminI18n.t('settings.infrastructure.saved'), AdminI18n.t('settings.infrastructure.databasePoolSaved'));
    } catch (err: any) {
      this.pending?.failed();
      this.runtime.notify.notify(NotificationType.ERROR, AdminI18n.t('settings.infrastructure.notSaved'), err?.message || '');
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
      <Card title={AdminI18n.t('settings.infrastructure.databasePool')}>
        <SettingRow
          theme={this.theme}
          title={AdminI18n.t('settings.infrastructure.databasePoolMax')}
          stacked
          description={AdminI18n.t('settings.infrastructure.databasePoolHelp')}
        >
          <div className="fc-settings-group">
            <div className="fc-settings-short fc-settings-short--narrow">
              <NumberStepper min={5} max={80} step={5} value={this.max} onChange={this.onMax} disabled={!this.loaded} />
            </div>
          </div>
        </SettingRow>
      </Card>
    );
  }
}

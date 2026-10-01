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

  async componentDidMount(): Promise<void> {
    try {
      const settings = await AdminSystemSettingsClient.getAll();
      this.max = String(settings?.[SystemConstants.META_KEY.DATABASE_POOL_MAX] ?? '');
      this.loaded = true;
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
      this.runtime.notify.notify(NotificationType.ERROR, AdminI18n.t('settings.infrastructure.notSaved'), err?.message || '');
    } finally {
      this.saving = false;
    }
  }

  render(): ReactNode {
    return (
      <Card title={AdminI18n.t('settings.infrastructure.databasePool')}>
        <SettingRow
          theme={this.theme}
          icon={FrameworkIcons.Database}
          title={AdminI18n.t('settings.infrastructure.databasePoolMax')}
          stacked
          description={AdminI18n.t('settings.infrastructure.databasePoolHelp')}
        >
          <div className="flex items-center gap-3">
            <div className="w-full md:w-40">
              <NumberStepper min={5} max={80} step={5} value={this.max} onChange={this.onMax} disabled={!this.loaded} />
            </div>
            <Button onClick={this.save} isLoading={this.saving} disabled={!this.loaded} icon={<FrameworkIcons.Save size={13} />} className="h-10 px-4 rounded-xl text-[11px] font-bold uppercase tracking-tight">
              {AdminI18n.t('settings.infrastructure.save')}
            </Button>
          </div>
        </SettingRow>
      </Card>
    );
  }
}

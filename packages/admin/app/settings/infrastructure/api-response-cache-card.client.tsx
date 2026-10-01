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
 * How long a kept answer to an anonymous plugin request may be served (the API's ApiResponseCache).
 *
 * Only routes a plugin declared the same for every visitor are kept, and every change on a site clears
 * them at once; this number bounds what no change announces. The field shows the stored value — the
 * declared default of 60 until the operator saves one — and 0 turns the cache off.
 */
export class ApiResponseCacheCard extends AdminComponent {
  @state seconds = '';
  @state loaded = false;
  @state saving = false;

  async componentDidMount(): Promise<void> {
    try {
      const settings = await AdminSystemSettingsClient.getAll();
      this.seconds = String(settings?.[SystemConstants.META_KEY.API_RESPONSE_CACHE_SECONDS] ?? '');
      this.loaded = true;
    } catch (err: any) {
      this.runtime.notify.notify(NotificationType.ERROR, AdminI18n.t('settings.infrastructure.apiResponseCacheUnavailable'), err?.message || '');
    }
  }

  @bound onSeconds(value: number | string): void { this.seconds = String(value); }

  @bound
  async save(): Promise<void> {
    this.saving = true;
    try {
      await AdminSystemSettingsClient.update({ [SystemConstants.META_KEY.API_RESPONSE_CACHE_SECONDS]: this.seconds });
      this.runtime.notify.notify(NotificationType.SUCCESS, AdminI18n.t('settings.infrastructure.saved'), AdminI18n.t('settings.infrastructure.apiResponseCacheSaved'));
    } catch (err: any) {
      this.runtime.notify.notify(NotificationType.ERROR, AdminI18n.t('settings.infrastructure.notSaved'), err?.message || '');
    } finally {
      this.saving = false;
    }
  }

  render(): ReactNode {
    return (
      <Card title={AdminI18n.t('settings.infrastructure.apiResponseCache')}>
        <SettingRow
          theme={this.theme}
          icon={FrameworkIcons.Clock}
          title={AdminI18n.t('settings.infrastructure.apiResponseCacheSeconds')}
          stacked
          description={AdminI18n.t('settings.infrastructure.apiResponseCacheHelp')}
        >
          <div className="flex items-center gap-3">
            <div className="w-full md:w-40">
              <NumberStepper min={0} step={10} value={this.seconds} onChange={this.onSeconds} disabled={!this.loaded} />
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

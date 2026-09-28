import type { ReactNode } from 'react';
import { bound, prop, state } from '@fromcode119/react-class-components';
import { ThemeMode } from '@fromcode119/core/client';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Switch } from '@/components/ui/view/switch.client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * Platform scope: whether sites may switch this plugin on for themselves. Offering it is the platform's
 * approval — the plugin is installed, reviewed and running here; a site only chooses to use it.
 */
export class PluginSiteOfferSwitch extends AdminComponent {
  @prop declare slug: string;
  @state offered: boolean | null = null;
  @state saving = false;

  async componentDidMount(): Promise<void> {
    try {
      const answer = await AdminApi.get(AdminConstants.ENDPOINTS.PLUGINS.OFFERED);
      this.offered = (answer?.offered ?? []).includes(this.slug);
    } catch (err: any) {
      this.runtime.notify.notify(NotificationType.ERROR, AdminI18n.t('plugins.detail.offerUnavailable'), err?.message || AdminI18n.t('plugins.detail.whetherThisPluginIsOffered'));
    }
  }

  @bound
  async toggle(offered: boolean): Promise<void> {
    this.saving = true;
    try {
      const answer = await AdminApi.post(AdminConstants.ENDPOINTS.PLUGINS.OFFER(this.slug), { offered });
      this.offered = Boolean(answer?.offered);
    } catch (err: any) {
      this.runtime.notify.notify(NotificationType.ERROR, AdminI18n.t('plugins.detail.notSaved'), err?.message || AdminI18n.t('plugins.detail.theOfferCouldNotBe'));
    } finally {
      this.saving = false;
    }
  }

  render(): ReactNode {
    const dark = this.theme === ThemeMode.DARK;
    return (
      <div className={`mt-4 pt-4 border-t ${dark ? 'border-slate-800/80' : 'border-slate-100'}`}>
        <Switch
          checked={this.offered === true}
          disabled={this.offered === null || this.saving}
          onChange={this.toggle}
          label={AdminI18n.t('plugins.detail.offeredToSites')}
          description={AdminI18n.t('plugins.detail.eachSiteSAdminMay')}
        />
      </div>
    );
  }
}

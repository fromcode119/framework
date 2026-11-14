import type { ReactNode } from 'react';
import { bound, state } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Card } from '@/components/ui/view/card.client';
import { Switch } from '@/components/ui/view/switch.client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import type { ISitePluginOffer } from '@/app/plugins/installed/interfaces/site-plugin-offer.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * In a site: the plugins the platform offers to sites, each with a switch for THIS site. The platform
 * installed and approved them; switching one on here adds it to this site only.
 */
export class SitePluginOffers extends AdminComponent {
  @state offers: ISitePluginOffer[] = [];
  @state loading = true;
  @state loadError = '';
  @state saving: string | null = null;

  async componentDidMount(): Promise<void> {
    try {
      const answer = await AdminApi.get(AdminConstants.ENDPOINTS.PLUGINS.OFFERED);
      this.offers = answer?.plugins ?? [];
    } catch (err: any) {
      this.loadError = err?.message || AdminI18n.t('plugins.list.thePluginsOfferedToSites');
    } finally {
      this.loading = false;
    }
  }

  @bound
  async toggle(slug: string, enabled: boolean): Promise<void> {
    this.saving = slug;
    try {
      await AdminApi.post(AdminConstants.ENDPOINTS.PLUGINS.SITE(slug), { enabled });
      this.offers = this.offers.map((offer) => (offer.slug === slug ? { ...offer, enabledHere: enabled } : offer));
      this.runtime.plugins.triggerRefresh();
      this.runtime.notify.notify(NotificationType.SUCCESS, enabled ? AdminI18n.t('plugins.list.addedToThisSite') : AdminI18n.t('plugins.list.removedFromThisSite'), AdminI18n.t(enabled ? 'plugins.list.nowOn' : 'plugins.list.nowOff', { slug }));
    } catch (err: any) {
      this.runtime.notify.notify(NotificationType.ERROR, AdminI18n.t('plugins.list.notChanged'), err?.message || AdminI18n.t('plugins.list.thePluginCouldNotBe2'));
    } finally {
      this.saving = null;
    }
  }

  render(): ReactNode {
    // Nothing offered is nothing to choose: the list below is the whole answer, and the line above it
    // already says where plugins are installed.
    if (!this.loading && !this.loadError && this.offers.length === 0) return null;
    return (
      <Card className="mb-3" title={AdminI18n.t('plugins.list.availableToThisSite')} description={AdminI18n.t('plugins.list.pluginsThePlatformOffersTo')}>
        {this.loading ? <p className="text-xs text-slate-500">{AdminI18n.t('plugins.list.loading')}</p>
          : this.loadError ? <p className="text-xs text-rose-500">{this.loadError}</p>
          : (
            <div className="space-y-4">
              {this.offers.map((offer) => (
                <Switch
                  key={offer.slug}
                  checked={offer.enabledHere}
                  disabled={this.saving !== null}
                  onChange={(enabled: boolean) => this.toggle(offer.slug, enabled)}
                  label={`${offer.name} · v${offer.version}`}
                  description={offer.description}
                />
              ))}
            </div>
          )}
      </Card>
    );
  }
}

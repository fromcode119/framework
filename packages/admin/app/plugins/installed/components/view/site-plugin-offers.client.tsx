import type { ReactNode } from 'react';
import { bound, state } from '@fromcode119/react-class-components';
import { ThemeMode } from '@fromcode119/core/client';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Card } from '@/components/ui/view/card.client';
import { Switch } from '@/components/ui/view/switch.client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminClass } from '@/lib/admin-class';
import type { ISitePluginOffer } from '@/app/plugins/installed/interfaces/site-plugin-offer.interface';

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
      this.loadError = err?.message || 'The plugins offered to sites could not be read.';
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
      this.runtime.notify.notify(NotificationType.SUCCESS, enabled ? 'Added to This Site' : 'Removed from This Site', `${slug} is ${enabled ? 'now on' : 'now off'} for this site.`);
    } catch (err: any) {
      this.runtime.notify.notify(NotificationType.ERROR, 'Not Changed', err?.message || 'The plugin could not be switched.');
    } finally {
      this.saving = null;
    }
  }

  render(): ReactNode {
    const dark = this.theme === ThemeMode.DARK;
    return (
      <Card className={`border-0 p-4 ${AdminClass.SURFACE} ${dark ? 'bg-slate-900/40' : 'bg-white shadow-sm'}`}>
        <h3 className={`text-[11px] font-semibold uppercase tracking-wider mb-1 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>Available to this site</h3>
        <p className="text-xs text-slate-500 mb-4">Plugins the platform offers to sites. Switching one on adds it to this site only.</p>
        {this.loading ? <p className="text-xs text-slate-500">Loading…</p>
          : this.loadError ? <p className="text-xs text-rose-500">{this.loadError}</p>
          : this.offers.length === 0 ? <p className="text-xs text-slate-500">The platform offers no plugins for sites to add yet.</p>
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

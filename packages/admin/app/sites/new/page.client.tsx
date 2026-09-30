import type { ReactNode } from 'react';
import { bound, state } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Button } from '@/components/ui/view/button.client';
import { Card } from '@/components/ui/view/card.client';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { Loader } from '@/components/ui/view/loader.client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { SiteInventory } from '@/lib/tenants/site-inventory';
import { SitesClient } from '@/lib/tenants/sites-client';
import { SiteFormValues } from '@/app/sites/site-form-values';
import { SiteForm } from '@/app/sites/components/view/site-form.client';
import { SitesTurningOnCard } from '@/app/sites/components/view/sites-turning-on-card.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/** Create a site: identity, hosts, first admin, the plugins it runs, the theme it renders with. */
export class NewSitePageClient extends AdminComponent {
  @state values: SiteFormValues = SiteFormValues.empty();
  @state inventory: SiteInventory | null = null;
  @state saving = false;
  @state firstSite: { id: string; restarting: boolean } | null = null;

  async componentDidMount(): Promise<void> {
    try {
      this.inventory = (await SitesClient.list()).inventory;
    } catch {
      this.inventory = SiteInventory.empty();
    }
  }

  @bound onChange(values: SiteFormValues): void {
    this.values = values;
  }

  @bound
  async save(): Promise<void> {
    this.saving = true;
    try {
      const { site, restart } = await SitesClient.create(this.values.toCreatePayload());
      if (restart) {
        // The first site: the api restarts to turn sites on, and the card below waits for it.
        this.firstSite = { id: site.id, restarting: restart.restarting };
        this.runtime.notify.addNotification({ title: AdminI18n.t('sites.siteCreated'), message: AdminI18n.t('sites.turningOn.explained'), type: NotificationType.INFO });
        return;
      }
      this.runtime.notify.addNotification({ title: AdminI18n.t('sites.siteCreated'), message: AdminI18n.t('sites.isLiveForRoutingNo', { primaryHost: site.primaryHost }), type: NotificationType.INFO });
      this.router.push(AdminConstants.ROUTES.SITES.DETAIL(site.id));
    } catch (err: any) {
      this.runtime.notify.addNotification({ title: AdminI18n.t('sites.notCreated'), message: err?.message || AdminI18n.t('sites.theSiteCouldNotBe'), type: NotificationType.ERROR });
    } finally {
      this.saving = false;
    }
  }

  render(): ReactNode {
    return (
      <div className="fc-sites">
        <CompactPageHeader
          theme={this.theme}
          icon={<FrameworkIcons.Globe size={18} strokeWidth={2} />}
          title={AdminI18n.t('sites.newSite')}
          subtitle={AdminI18n.t('sites.aSiteIsACustomer')}
          backHref={AdminConstants.ROUTES.SITES.ROOT}
          actions={this.firstSite ? null : <Button onClick={this.save} isLoading={this.saving} icon={<FrameworkIcons.Save size={14} />}>{AdminI18n.t('sites.createSite')}</Button>}
        />
        <div className="fc-sites__body">
        {this.firstSite ? (
          <SitesTurningOnCard tenantId={this.firstSite.id} restarting={this.firstSite.restarting} fallbackHref={AdminConstants.ROUTES.SITES.DETAIL(this.firstSite.id)} />
        ) : (
          <Card title={AdminI18n.t('sites.identityAndInventory')}>
            {this.inventory ? <SiteForm theme={this.theme} values={this.values} onChange={this.onChange} inventory={this.inventory} isNew /> : <Loader label={AdminI18n.t('sites.loadingInstalledPluginsAndThemes')} />}
          </Card>
        )}
        </div>
      </div>
    );
  }
}

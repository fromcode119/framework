import type { ReactNode } from 'react';
import { bound, state } from '@fromcode119/reactor';
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

/** Create a site: identity, hosts, first admin, the plugins it runs, the theme it renders with. */
export class NewSitePageClient extends AdminComponent {
  @state values: SiteFormValues = SiteFormValues.empty();
  @state inventory: SiteInventory | null = null;
  @state saving = false;

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
      const site = await SitesClient.create(this.values.toCreatePayload());
      this.runtime.notify.addNotification({ title: 'Site created', message: `${site.primaryHost} is live for routing — no restart needed.`, type: NotificationType.INFO });
      this.router.push(AdminConstants.ROUTES.SITES.DETAIL(site.id));
    } catch (err: any) {
      this.runtime.notify.addNotification({ title: 'Not created', message: err?.message || 'The site could not be created.', type: NotificationType.ERROR });
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
          title="New site"
          subtitle="A site is a customer: its own hosts, content, people, plugins and theme on this shared platform."
          backHref={AdminConstants.ROUTES.SITES.ROOT}
          actions={<Button onClick={this.save} isLoading={this.saving} icon={<FrameworkIcons.Save size={14} />}>Create site</Button>}
        />
        <div className="fc-sites__body">
        <Card title="Identity and inventory">
          {this.inventory ? <SiteForm theme={this.theme} values={this.values} onChange={this.onChange} inventory={this.inventory} isNew /> : <Loader label="Loading installed plugins and themes…" />}
        </Card>
        </div>
      </div>
    );
  }
}

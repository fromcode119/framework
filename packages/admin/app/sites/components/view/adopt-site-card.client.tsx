import type { ReactNode } from 'react';
import { bound, state } from '@fromcode119/reactor';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Button } from '@/components/ui/view/button.client';
import { Card } from '@/components/ui/view/card.client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { SitesClient } from '@/lib/tenants/sites-client';
import { SiteFormValues } from '@/app/sites/site-form-values';
import { SiteForm } from '@/app/sites/components/view/site-form.client';

/**
 * Shown on a deployment with NO sites: this installation IS one site, and the operator can make it
 * the platform's first tenant in place. Every row gets the new tenant's id, every account becomes a
 * member with its current roles, the active plugins and theme become the tenant's. Tenancy itself is
 * decided at boot, so the card says plainly that a restart follows.
 */
export class AdoptSiteCard extends AdminComponent {
  @state values: SiteFormValues = SiteFormValues.empty();
  @state busy = false;
  @state outcome: Record<string, any> | null = null;

  declare props: { onAdopted: () => void };

  @bound onChange(values: SiteFormValues): void {
    this.values = values;
  }

  @bound
  async adopt(): Promise<void> {
    this.busy = true;
    try {
      this.outcome = await SitesClient.adopt(this.values.toIdentity());
      this.runtime.notify.addNotification({ title: 'Deployment adopted', message: 'Restart the API for tenancy to take effect.', type: NotificationType.INFO });
      this.props.onAdopted();
    } catch (err: any) {
      this.runtime.notify.addNotification({ title: 'Adoption failed', message: err?.message || 'Nothing was changed.', type: NotificationType.ERROR });
    } finally {
      this.busy = false;
    }
  }

  render(): ReactNode {
    if (this.outcome) {
      const stamped = Object.entries(this.outcome.stamped ?? {}) as Array<[string, number]>;
      const unassigned = Object.entries(this.outcome.unassigned ?? {}) as Array<[string, number]>;
      return (
        <Card title="Adopted — restart required" icon={<FrameworkIcons.CheckCircle size={16} />}>
          <p className="fc-sites__text">
            This deployment is now site <strong>{this.outcome.tenant?.slug}</strong>: {stamped.reduce((sum, [, n]) => sum + n, 0)} rows across {stamped.length} tables
            were stamped and {this.outcome.members} accounts became members. Restart the API (Settings → Infrastructure → Restart Services) — tenancy is decided at boot.
          </p>
          {unassigned.length > 0 ? (
            <p className="fc-sites__text fc-sites__text--warn">
              Rows still without an owner (they will be INVISIBLE once isolation is on): {unassigned.map(([table, n]) => `${table} (${n})`).join(', ')}.
            </p>
          ) : null}
        </Card>
      );
    }
    return (
      <Card title="This deployment is not multi-tenant yet" icon={<FrameworkIcons.Globe size={16} />}>
        <p className="fc-sites__text">
          There are no sites because everything here belongs to ONE site — this one. Adopting turns it into the platform's first site in place:
          every existing row is stamped with the new site's id, every account becomes a member with the roles it already has, and the active
          plugins and theme become the site's. Nothing is copied or moved. <strong>The API must be restarted afterwards.</strong>
        </p>
        <SiteForm theme={this.theme} values={this.values} onChange={this.onChange} isNew />
        <div className="fc-sites__actions">
          <Button onClick={this.adopt} isLoading={this.busy} icon={<FrameworkIcons.Globe size={14} />}>Adopt as the first site</Button>
        </div>
      </Card>
    );
  }
}

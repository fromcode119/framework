import type { ReactNode } from 'react';
import { bound, prop, state } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { ThemeMode } from '@fromcode119/core/client';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Button } from '@/components/ui/view/button.client';
import { Card } from '@/components/ui/view/card.client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { SiteRecord } from '@/lib/tenants/site-record';
import { SiteFormValues } from '@/app/sites/site-form-values';
import { SiteForm } from '@/app/sites/components/view/site-form.client';
import { SiteStatStrip } from '@/app/sites/[id]/site-stat-strip.client';
import { SitesClient } from '@/lib/tenants/sites-client';

/**
 * Identity, addressing and what the site amounts to — short enough to read without scrolling.
 *
 * The member roster, the entitlement toggles and the archives all used to sit below this, so the
 * things you glance at were separated from each other by twenty-five rows of other people's e-mail
 * addresses.
 *
 * Rebuilding pages lives HERE rather than on the page that hosts this tab, with the card that states
 * how many pages there are: the count is the reason anyone presses the button, and an action whose
 * justification is rendered by one component and performed by another is two places to keep in step.
 */
export class SiteOverviewTab extends AdminComponent {
  declare props: Pick<SiteOverviewTab, 'site' | 'values' | 'onChange' | 'onRebuilt'>;

  @prop declare site: SiteRecord;
  @prop declare values: SiteFormValues;
  @prop declare onChange: (values: SiteFormValues) => void;
  /** Re-reads the site, so the page count this card prints is the one the rebuild produced. */
  @prop declare onRebuilt: () => void;

  @state private seeding = false;

  /**
   * Builds the site's pages from its theme's initial content and its plugins' default page contracts.
   *
   * The same work a new site gets at creation. A site that gained a plugin, or changed theme, has
   * pages it never received — and the endpoint existed all along with nothing in the admin calling it.
   */
  @bound private async seed(): Promise<void> {
    this.seeding = true;
    try {
      const result = await SitesClient.materializePages(this.site.id);
      const warnings = result.warnings.length ? ` Warnings: ${result.warnings.join('; ')}` : '';
      this.runtime.notify.addNotification({
        title: 'Pages rebuilt',
        message: `${result.pages} page${result.pages === 1 ? '' : 's'} on this site.`
          + `${result.themeSeeded ? ' The theme\'s initial content was seeded.' : ''}${warnings}`,
        type: result.warnings.length ? NotificationType.ERROR : NotificationType.INFO,
      });
      this.onRebuilt();
    } catch (err: any) {
      this.runtime.notify.addNotification({ title: 'Could not rebuild pages', message: err?.message || 'The rebuild did not complete.', type: NotificationType.ERROR });
    } finally {
      this.seeding = false;
    }
  }

  /** A workspace has no storefront, so it has no pages to build. */
  private renderPages(): ReactNode {
    const site = this.site;
    if (site.isWorkspace) return null;
    return (
      <Card title="Pages">
        <p className="fc-sites__text">
          {site.pageCount
            ? <>This site has <strong>{site.pageCount}</strong> page{site.pageCount === 1 ? '' : 's'}. </>
            : <>This site has <strong>no pages</strong>, so every storefront route but the home page answers 404. </>}
          Rebuilding runs the theme&apos;s initial content and the default pages its plugins declare. Existing
          pages are matched, never duplicated, so it is safe to run again after adding a plugin or changing theme.
        </p>
        <div className="fc-sites__actions">
          <Button onClick={this.seed} isLoading={this.seeding} icon={<FrameworkIcons.Refresh size={14} />}>Rebuild pages</Button>
        </div>
      </Card>
    );
  }

  render(): ReactNode {
    const theme = this.theme as ThemeMode;
    return (
      <>
        <SiteStatStrip site={this.site} theme={theme} />
        <div className="fc-sites__overview">
          <Card title="Identity and hosts">
            <SiteForm theme={theme} values={this.values} onChange={this.onChange} isNew={false} />
          </Card>
          {this.renderPages()}
        </div>
      </>
    );
  }
}

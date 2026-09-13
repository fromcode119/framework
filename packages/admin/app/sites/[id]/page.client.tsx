import type { ReactNode } from 'react';
import { bound, state } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Button } from '@/components/ui/view/button.client';
import { Card } from '@/components/ui/view/card.client';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { Loader } from '@/components/ui/view/loader.client';
import { LoadErrorPanel } from '@/components/ui/view/load-error-panel.client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminApi } from '@/lib/api';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { SiteRecord } from '@/lib/tenants/site-record';
import { SiteInventory } from '@/lib/tenants/site-inventory';
import { SiteTab } from '@/app/sites/[id]/site-tab.enum';
import { SiteTabBar } from '@/app/sites/[id]/site-tab-bar.client';
import { SiteAccessCard } from '@/app/sites/[id]/site-access-card.client';
import { SiteExportsCard } from '@/app/sites/[id]/site-exports-card.client';
import { SiteStatStrip } from '@/app/sites/[id]/site-stat-strip.client';
import { SitesClient } from '@/lib/tenants/sites-client';
import { SiteFormValues } from '@/app/sites/site-form-values';
import { SiteForm } from '@/app/sites/components/view/site-form.client';
import { SiteDomainsCard } from '@/app/sites/[id]/site-domains-card.client';
import { SiteMembersCard } from '@/app/sites/[id]/site-members-card.client';
import { SiteDangerCard } from '@/app/sites/[id]/site-danger-card.client';

/** One site: identity and state, its members, its exports, and the one irreversible action. */
export class SiteDetailPageClient extends AdminComponent {
  @state site: SiteRecord | null = null;
  @state values: SiteFormValues = SiteFormValues.empty();
  @state loading = true;
  @state error: string | null = null;
  @state saving = false;
  @state exporting = false;
  @state seeding = false;
  @state entering = false;
  @state tab: SiteTab = SiteTab.OVERVIEW;

  @bound selectTab(tab: SiteTab): void {
    this.tab = tab;
  }

  /** Opens the storefront itself — the site's own domain, not the admin for it. */
  @bound visitSite(): void {
    window.open(this.site?.storefrontUrl ?? '/', '_blank', 'noopener');
  }
  /**
   * Loaded for the site's own appearance choice only — NOT to offer plugins and themes here.
   *
   * Those are edited on the Plugins and Themes pages with this site selected, which is a better place
   * than a second, thinner copy: the same controls in two places is the limitation, not the fix.
   */
  @state inventory: SiteInventory | null = null;

  private get id(): string {
    return String(this.runtimeParams?.id ?? '');
  }

  componentDidMount(): void {
    this.load();
  }

  @bound
  async load(): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      const [site, listing] = await Promise.all([SitesClient.get(this.id), SitesClient.list()]);
      this.inventory = listing.inventory;
      this.apply(site);
    } catch (err: any) {
      this.error = err?.message || 'Could not load the site.';
    } finally {
      this.loading = false;
    }
  }

  @bound apply(site: SiteRecord): void {
    this.site = site;
    this.values = SiteFormValues.fromSite(site);
  }

  @bound onChange(values: SiteFormValues): void {
    this.values = values;
  }

  @bound
  async save(): Promise<void> {
    this.saving = true;
    try {
      this.apply(await SitesClient.update(this.id, this.values.toUpdatePayload()));
      this.runtime.notify.addNotification({ title: 'Site saved', message: 'Routing follows immediately — no restart.', type: NotificationType.INFO });
    } catch (err: any) {
      this.runtime.notify.addNotification({ title: 'Not saved', message: err?.message || 'The site could not be saved.', type: NotificationType.ERROR });
    } finally {
      this.saving = false;
    }
  }

  @bound
  async exportSite(): Promise<void> {
    this.exporting = true;
    try {
      const result = await SitesClient.exportSite(this.id);
      this.runtime.notify.addNotification({ title: 'Site exported', message: `${result.filename} (${result.rows} rows) is under Backups → Sites.`, type: NotificationType.INFO });
      await this.load();
    } catch (err: any) {
      this.runtime.notify.addNotification({ title: 'Export failed', message: err?.message || 'The export did not complete.', type: NotificationType.ERROR });
    } finally {
      this.exporting = false;
    }
  }

  /**
   * Builds the site's pages from its theme's initial content and its plugins' default page contracts.
   *
   * The same work a new site gets at creation. A site that gained a plugin, or changed theme, has pages
   * it never received — and the endpoint has existed all along with nothing in the admin calling it.
   */
  @bound
  async seed(): Promise<void> {
    this.seeding = true;
    try {
      const result = await SitesClient.materializePages(this.id);
      const warnings = result.warnings.length ? ` Warnings: ${result.warnings.join('; ')}` : '';
      this.runtime.notify.addNotification({
        title: 'Pages rebuilt',
        message: `${result.pages} page${result.pages === 1 ? '' : 's'} on this site.`
          + `${result.themeSeeded ? ' The theme\'s initial content was seeded.' : ''}${warnings}`,
        type: result.warnings.length ? NotificationType.ERROR : NotificationType.INFO,
      });
      await this.load();
    } catch (err: any) {
      this.runtime.notify.addNotification({ title: 'Could not rebuild pages', message: err?.message || 'The rebuild did not complete.', type: NotificationType.ERROR });
    } finally {
      this.seeding = false;
    }
  }

  /**
   * Enters the site: the admin switches to it, and every ordinary page — Plugins, Themes, Content —
   * then acts on THIS site.
   *
   * The one thing this page could offer that nothing else does. Everything a site's own pages already
   * do well is done there, with this as the way in, rather than rebuilt here as a thinner copy.
   *
   * Selects through the same endpoint the header switcher uses, and reloads for the same reason it
   * does: the previous site's data must not linger in memory.
   */
  @bound
  async enterSite(): Promise<void> {
    this.entering = true;
    try {
      await AdminApi.post(AdminConstants.ENDPOINTS.AUTH.TENANTS_SELECT, { tenantId: this.id });
      window.location.assign(AdminConstants.ROUTES.ROOT);
    } catch (err: any) {
      this.entering = false;
      this.runtime.notify.addNotification({ title: 'Could not open the site', message: err?.message || 'The site could not be selected.', type: NotificationType.ERROR });
    }
  }

  @bound onDeleted(): void {
    this.router.push(AdminConstants.ROUTES.SITES.ROOT);
  }



  /**
   * Identity, addressing and what the site amounts to — short enough to read without scrolling.
   *
   * The member roster, the entitlement toggles and the archives all used to sit below this, so the
   * things you glance at were separated from each other by twenty-five rows of other people's e-mail
   * addresses.
   */
  private renderOverview(site: SiteRecord): ReactNode {
    return (
      <>
        <SiteStatStrip site={site} theme={this.theme} />
        <div className="fc-sites__overview">
        <Card title="Identity and hosts">
          <SiteForm theme={this.theme} values={this.values} onChange={this.onChange} isNew={false} />
        </Card>
        {site.isWorkspace ? null : (
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
        )}
        </div>
      </>
    );
  }

  render(): ReactNode {
    const site = this.site;
    return (
      <div className="fc-sites">
        <CompactPageHeader
          theme={this.theme}
          icon={<FrameworkIcons.Globe size={18} strokeWidth={2} />}
          title={site ? site.slug : 'Site'}
          subtitle={site ? site.primaryHost : ''}
          backHref={AdminConstants.ROUTES.SITES.ROOT}
          actions={site ? (
            <div className="fc-sites__actions">
              <Button onClick={this.enterSite} isLoading={this.entering} icon={<FrameworkIcons.ArrowRight size={14} />}>Open this site</Button>
              {site.isWorkspace ? null : (
                <Button variant={ButtonVariant.OUTLINE} onClick={this.visitSite} icon={<FrameworkIcons.ExternalLink size={14} />}>Visit</Button>
              )}
              <Button variant={ButtonVariant.OUTLINE} onClick={this.exportSite} isLoading={this.exporting} icon={<FrameworkIcons.Download size={14} />}>Export</Button>
              <Button onClick={this.save} isLoading={this.saving} icon={<FrameworkIcons.Save size={14} />}>Save</Button>
            </div>
          ) : null}
        />
        <div className="fc-sites__body">
        {this.loading ? <Loader label="Loading site…" /> : null}
        {!this.loading && this.error ? <LoadErrorPanel title="Site unavailable" message={this.error} onRetry={this.load} /> : null}
        {site && !this.loading ? (
          <div className="fc-sites__stack">
            <SiteTabBar current={this.tab} onSelect={this.selectTab} />
            {this.tab.value === SiteTab.OVERVIEW.value ? this.renderOverview(site) : null}
            {this.tab.value === SiteTab.ACCESS.value
              ? <SiteAccessCard values={this.values} inventory={this.inventory} onChange={this.onChange} onActivated={this.load} />
              : null}
            {this.tab.value === SiteTab.DOMAINS.value ? <SiteDomainsCard tenantId={site.id} /> : null}
            {this.tab.value === SiteTab.MEMBERS.value ? <SiteMembersCard site={site} onChanged={this.apply} /> : null}
            {this.tab.value === SiteTab.EXPORTS.value ? <SiteExportsCard site={site} theme={this.theme} /> : null}
            {this.tab.value === SiteTab.DANGER.value ? <SiteDangerCard site={site} onDeleted={this.onDeleted} /> : null}
          </div>
        ) : null}
        </div>
      </div>
    );
  }
}

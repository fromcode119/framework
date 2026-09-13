import type { ReactNode } from 'react';
import { bound, state } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { Loader } from '@/components/ui/view/loader.client';
import { LoadErrorPanel } from '@/components/ui/view/load-error-panel.client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminApi } from '@/lib/api';
import { SiteRecord } from '@/lib/tenants/site-record';
import { SiteInventory } from '@/lib/tenants/site-inventory';
import { SiteTab } from '@/app/sites/[id]/site-tab.enum';
import { SiteTabBar } from '@/app/sites/[id]/site-tab-bar.client';
import { SiteAccessCard } from '@/app/sites/[id]/site-access-card.client';
import { SiteExportsCard } from '@/app/sites/[id]/site-exports-card.client';
import { SiteActionBar } from '@/app/sites/[id]/site-action-bar.client';
import { SiteOverviewTab } from '@/app/sites/[id]/site-overview-tab.client';
import { SitesClient } from '@/lib/tenants/sites-client';
import { SitePreviewLauncher } from '@/lib/tenants/site-preview-launcher';
import { SiteFormValues } from '@/app/sites/site-form-values';
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
  @state entering = false;
  @state previewing = false;
  @state tab: SiteTab = SiteTab.OVERVIEW;

  @bound selectTab(tab: SiteTab): void {
    this.tab = tab;
  }

  /**
   * Opens the storefront itself — the site's own domain, not the admin for it.
   *
   * A PUBLISHED site is a plain link. An UNPUBLISHED one cannot be, because the console's session
   * never reaches the site's host; see SitePreviewLauncher for why, and for the tab handling.
   */
  @bound async visitSite(): Promise<void> {
    const site = this.site;
    if (!site) return;
    if (!site.isPrivate) {
      SitePreviewLauncher.open(site.storefrontUrl);
      return;
    }

    this.previewing = true;
    try {
      await SitePreviewLauncher.openPreview(this.id);
    } catch (err: any) {
      this.runtime.notify.addNotification({
        title: 'Could not open a preview',
        message: err?.message || 'This site could not be opened for preview.',
        type: NotificationType.ERROR,
      });
    } finally {
      this.previewing = false;
    }
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

  @bound async load(): Promise<void> {
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

  @bound async save(): Promise<void> {
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

  @bound async exportSite(): Promise<void> {
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
   * Enters the site: the admin switches to it, and every ordinary page — Plugins, Themes, Content —
   * then acts on THIS site.
   *
   * The one thing this page could offer that nothing else does. Everything a site's own pages already
   * do well is done there, with this as the way in, rather than rebuilt here as a thinner copy.
   *
   * Selects through the same endpoint the header switcher uses, and reloads for the same reason it
   * does: the previous site's data must not linger in memory.
   */
  @bound async enterSite(): Promise<void> {
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
            <SiteActionBar
              site={site}
              entering={this.entering} previewing={this.previewing} exporting={this.exporting} saving={this.saving}
              onEnter={this.enterSite} onVisit={this.visitSite} onExport={this.exportSite} onSave={this.save}
            />
          ) : null}
        />
        <div className="fc-sites__body">
        {this.loading ? <Loader label="Loading site…" /> : null}
        {!this.loading && this.error ? <LoadErrorPanel title="Site unavailable" message={this.error} onRetry={this.load} /> : null}
        {site && !this.loading ? (
          <div className="fc-sites__stack">
            <SiteTabBar current={this.tab} onSelect={this.selectTab} />
            {this.tab.value === SiteTab.OVERVIEW.value
              ? <SiteOverviewTab site={site} values={this.values} onChange={this.onChange} onRebuilt={this.load} />
              : null}
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

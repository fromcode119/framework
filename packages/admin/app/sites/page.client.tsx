import type { ReactNode } from 'react';
import { bound, state } from '@fromcode119/reactor';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { Loader } from '@/components/ui/view/loader.client';
import { LoadErrorPanel } from '@/components/ui/view/load-error-panel.client';
import { PromptDialog } from '@/components/ui/view/prompt-dialog.client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { SiteRecord } from '@/lib/tenants/site-record';
import { SiteInventory } from '@/lib/tenants/site-inventory';
import { SitesClient } from '@/lib/tenants/sites-client';
import { AdoptSiteCard } from '@/app/sites/components/view/adopt-site-card.client';
import { SitesTable } from '@/app/sites/components/view/sites-table.client';
import { AdminClass } from '@/lib/admin-class';
import { PlatformAccess } from '@/lib/tenants/platform-access';
import { PlatformOnlyPanel } from '@/components/view/platform-only-panel.client';

/**
 * Every site on this platform, and the actions that create, move and remove one.
 *
 * On a deployment that is still single-tenant the table is empty by definition and the page offers
 * ADOPTION instead: turning this very deployment into its first site, in place.
 */
export class SitesPageClient extends AdminComponent {
  @state sites: SiteRecord[] = [];
  @state inventory: SiteInventory = SiteInventory.empty();
  @state multiTenant = false;
  @state loading = true;
  @state error: string | null = null;
  @state busyId: string | null = null;
  @state deleting: SiteRecord | null = null;

  /**
   * Managing the list of sites is the PLATFORM's job, not a site's.
   *
   * Every route behind this page carries `PlatformAdminGuard`, so for a site administrator the page
   * could only ever load, fail, and report `platform_admin_required` in a panel headed "Sites
   * unavailable" — which reads like an outage rather than the boundary it is. Answer before asking.
   */
  private get canManagePlatform(): boolean {
    return PlatformAccess.canManagePlatform(this.auth.user);
  }

  componentDidMount(): void {
    if (!this.canManagePlatform) {
      this.loading = false;
      return;
    }
    this.load();
  }

  @bound
  async load(): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      const result = await SitesClient.list();
      this.sites = result.sites;
      this.inventory = result.inventory;
      this.multiTenant = result.multiTenant;
    } catch (err: any) {
      this.error = err?.message || 'Could not load the sites.';
    } finally {
      this.loading = false;
    }
  }

  @bound
  async exportSite(site: SiteRecord): Promise<void> {
    this.busyId = site.id;
    try {
      const result = await SitesClient.exportSite(site.id);
      this.notify(NotificationType.INFO, 'Site exported', `${result.filename} (${result.rows} rows) is under Backups → Sites.`);
      await this.load();
    } catch (err: any) {
      this.notify(NotificationType.ERROR, 'Export failed', err?.message || 'The export did not complete.');
    } finally {
      this.busyId = null;
    }
  }

  @bound
  async toggleState(site: SiteRecord): Promise<void> {
    this.busyId = site.id;
    try {
      await SitesClient.update(site.id, { state: site.isActive ? 'suspended' : 'active' });
      this.notify(NotificationType.INFO, site.isActive ? 'Site suspended' : 'Site reactivated', `${site.primaryHost} now answers ${site.isActive ? '503' : 'normally'}.`);
      await this.load();
    } catch (err: any) {
      this.notify(NotificationType.ERROR, 'Change failed', err?.message || 'The state was not changed.');
    } finally {
      this.busyId = null;
    }
  }

  @bound
  askDelete(site: SiteRecord): void {
    this.deleting = site;
  }

  @bound
  closeDelete(): void {
    this.deleting = null;
  }

  @bound
  async confirmDelete(typed: string): Promise<void> {
    const site = this.deleting;
    if (!site) return;
    if (typed.trim() !== site.slug) {
      this.notify(NotificationType.ERROR, 'Not deleted', `Type "${site.slug}" exactly to confirm.`);
      return;
    }
    this.busyId = site.id;
    try {
      const result = await SitesClient.remove(site.id, typed.trim());
      this.deleting = null;
      this.notify(NotificationType.INFO, 'Site deleted', `Exported to ${result.archive} first; ${Object.values(result.deleted).reduce((a, b) => a + b, 0)} rows and ${result.files} files removed.`);
      await this.load();
    } catch (err: any) {
      this.notify(NotificationType.ERROR, 'Delete failed', err?.message || 'Nothing was deleted.');
    } finally {
      this.busyId = null;
    }
  }

  @bound
  openSite(site: SiteRecord): void {
    this.router.push(AdminConstants.ROUTES.SITES.DETAIL(site.id));
  }

  private notify(type: NotificationType, title: string, message: string): void {
    this.runtime.notify.addNotification({ title, message, type });
  }

  render(): ReactNode {
    const theme = this.theme;
    return (
      <div className="fc-sites">
        <CompactPageHeader
          theme={theme}
          icon={<FrameworkIcons.Globe size={18} strokeWidth={2} />}
          title="Sites"
          subtitle="Every customer site this platform serves — its hosts, its plugins, its theme, its people."
          actions={this.multiTenant && this.canManagePlatform ? (
            <div className="fc-sites__actions">
              <Button variant={ButtonVariant.OUTLINE} href={AdminConstants.ROUTES.SITES.IMPORT} icon={<FrameworkIcons.Upload size={14} />}>Import</Button>
              <Button href={AdminConstants.ROUTES.SITES.NEW} icon={<FrameworkIcons.Plus size={14} />}>New site</Button>
            </div>
          ) : null}
        />

        <div className="fc-sites__body">
        {!this.canManagePlatform ? (
          <PlatformOnlyPanel detail="Sites lists every customer site running on this platform, and only a platform admin may create, move or remove one. You administer your own site from the rest of the admin — the header shows which site you are in, and switching there changes what you are administering." />
        ) : null}

        {this.canManagePlatform && this.loading ? <Loader label="Loading sites…" /> : null}
        {this.canManagePlatform && !this.loading && this.error ? <LoadErrorPanel title="Sites unavailable" message={this.error} onRetry={this.load} /> : null}

        {this.canManagePlatform && !this.loading && !this.error && !this.multiTenant ? <AdoptSiteCard onAdopted={this.load} /> : null}

        {this.canManagePlatform && !this.loading && !this.error && this.multiTenant ? (
          <div className={`${AdminClass.SURFACE} overflow-hidden`}>
            <SitesTable
              theme={theme}
              sites={this.sites}
              busyId={this.busyId}
              onOpen={this.openSite}
              onExport={this.exportSite}
              onToggleState={this.toggleState}
              onDelete={this.askDelete}
            />
          </div>
        ) : null}
        </div>

        <PromptDialog
          isOpen={this.deleting !== null}
          onClose={this.closeDelete}
          onConfirm={this.confirmDelete}
          title={this.deleting ? `Delete ${this.deleting.slug}?` : 'Delete site'}
          description={this.deleting ? `Every row and file of ${this.deleting.primaryHost} will be removed after an export is written to Backups → Sites. Type the slug "${this.deleting.slug}" to confirm.` : ''}
          placeholder={this.deleting?.slug}
          confirmLabel="Export and delete"
          isLoading={this.busyId !== null && this.deleting !== null}
          icon={<FrameworkIcons.Trash size={16} />}
        />
      </div>
    );
  }
}

import type { ReactNode } from 'react';
import { bound, state } from '@fromcode119/reactor';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Button } from '@/components/ui/view/button.client';
import { Card } from '@/components/ui/view/card.client';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { Loader } from '@/components/ui/view/loader.client';
import { LoadErrorPanel } from '@/components/ui/view/load-error-panel.client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { SiteRecord } from '@/lib/tenants/site-record';
import { SitesClient } from '@/lib/tenants/sites-client';
import { SiteFormValues } from '@/app/sites/site-form-values';
import { SiteForm } from '@/app/sites/components/view/site-form.client';
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
      this.apply(await SitesClient.get(this.id));
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
          subtitle={site ? `${site.primaryHost} · ${site.memberCount} member${site.memberCount === 1 ? '' : 's'} · ${site.plugins.length} plugin${site.plugins.length === 1 ? '' : 's'} · ${site.theme ?? 'no theme'}` : ''}
          backHref={AdminConstants.ROUTES.SITES.ROOT}
          actions={site ? (
            <div className="fc-sites__actions">
              <Button onClick={this.exportSite} isLoading={this.exporting} icon={<FrameworkIcons.Download size={14} />}>Export</Button>
              <Button onClick={this.save} isLoading={this.saving} icon={<FrameworkIcons.Save size={14} />}>Save</Button>
            </div>
          ) : null}
        />
        <div className="fc-sites__body">
        {this.loading ? <Loader label="Loading site…" /> : null}
        {!this.loading && this.error ? <LoadErrorPanel title="Site unavailable" message={this.error} onRetry={this.load} /> : null}
        {site && !this.loading ? (
          <div className="fc-sites__stack">
            <Card title="Identity and hosts">
              <SiteForm theme={this.theme} values={this.values} onChange={this.onChange} isNew={false} />
              <p className="fc-site-form__hint">
                Plugins and theme for this site are managed on the Plugins and Themes pages with <strong>{site.slug}</strong> selected in the header.
                Currently: {site.plugins.length ? site.plugins.join(', ') : 'no plugins'}; theme {site.theme ?? 'none'}.
              </p>
            </Card>
            <SiteMembersCard site={site} onChanged={this.apply} />
            <Card title="Exports">
              <p className="fc-sites__text">
                {site.lastExport ? <>Last export: <code>{site.lastExport}</code>. </> : 'Never exported. '}
                Exports are portable archives (rows, files, members, plugin and theme choices) and appear under Settings → Backups → Sites, where they can be downloaded.
              </p>
            </Card>
            <SiteDangerCard site={site} onDeleted={this.onDeleted} />
          </div>
        ) : null}
        </div>
      </div>
    );
  }
}

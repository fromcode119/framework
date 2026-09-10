import type { ChangeEvent, ReactNode } from 'react';
import { bound, state } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { Card } from '@/components/ui/view/card.client';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { SitesClient } from '@/lib/tenants/sites-client';
import { SiteFormValues } from '@/app/sites/site-form-values';
import { SiteForm } from '@/app/sites/components/view/site-form.client';
import { ImportPlanView } from '@/app/sites/import/import-plan-view.client';

/**
 * Import a site archive: upload → identity → PREVIEW → execute.
 *
 * The preview is not optional. It is the only place the operator learns which tables will be
 * re-numbered, which plugins/themes are missing here, which people already have accounts — before a
 * row is written. Execute is enabled only after a preview with no blockers.
 */
export class ImportSitePageClient extends AdminComponent {
  @state file: File | null = null;
  @state uploadId: string | null = null;
  @state uploadPercent = 0;
  @state values: SiteFormValues = SiteFormValues.empty();
  @state plan: Record<string, any> | null = null;
  @state result: Record<string, any> | null = null;
  @state busy = false;

  private readonly fileInput = this.ref<HTMLInputElement>();

  @bound onFile(e: ChangeEvent<HTMLInputElement>): void {
    this.file = e.target.files?.[0] ?? null;
    this.uploadId = null;
    this.plan = null;
    this.result = null;
  }

  @bound onChange(values: SiteFormValues): void {
    this.values = values;
    this.plan = null;
  }

  @bound
  async upload(): Promise<void> {
    if (!this.file) return;
    this.busy = true;
    try {
      this.uploadId = await SitesClient.uploadArchive(this.file, (percent) => { this.uploadPercent = percent; });
      // Preview once straight away with the archive's own identity, so the operator sees the site it holds.
      const plan = await SitesClient.previewImport(this.uploadId, {});
      const archived = plan?.manifest?.tenant ?? {};
      this.values = SiteFormValues.empty().with({ slug: String(archived.slug ?? ''), id: String(archived.slug ?? ''), primaryHost: String(archived.primaryHost ?? ''), hostAliases: (archived.hostAliases ?? []).join(', ') });
      this.plan = plan;
    } catch (err: any) {
      this.notify(NotificationType.ERROR, 'Upload failed', err?.message || 'The archive could not be read.');
    } finally {
      this.busy = false;
    }
  }

  @bound
  async preview(): Promise<void> {
    if (!this.uploadId) return;
    this.busy = true;
    try {
      this.plan = await SitesClient.previewImport(this.uploadId, this.values.toIdentity());
    } catch (err: any) {
      this.notify(NotificationType.ERROR, 'Preview failed', err?.message || 'The import could not be planned.');
    } finally {
      this.busy = false;
    }
  }

  @bound
  async execute(): Promise<void> {
    if (!this.uploadId || !this.plan?.canExecute) return;
    this.busy = true;
    try {
      this.result = await SitesClient.executeImport(this.uploadId, this.values.toIdentity());
      this.notify(NotificationType.INFO, 'Site imported', `${this.result?.tenant?.primaryHost} is live for routing — no restart needed.`);
    } catch (err: any) {
      this.notify(NotificationType.ERROR, 'Import failed', err?.message || 'Nothing was imported.');
    } finally {
      this.busy = false;
    }
  }

  private notify(type: NotificationType, title: string, message: string): void {
    this.runtime.notify.addNotification({ title, message, type });
  }

  render(): ReactNode {
    const result = this.result;
    return (
      <div className="fc-sites">
        <CompactPageHeader
          theme={this.theme}
          icon={<FrameworkIcons.Upload size={18} strokeWidth={2} />}
          title="Import a site"
          subtitle="From an export made here, or from a single-tenant deployment exported with the tenant-export CLI."
          backHref={AdminConstants.ROUTES.SITES.ROOT}
        />
        <div className="fc-sites__body">
        <div className="fc-sites__stack">
          <Card title="1. Archive">
            <div className="fc-sites__upload">
              <input ref={this.fileInput} type="file" accept=".tar.gz,.tgz" onChange={this.onFile} className="fc-sites__file" />
              <Button onClick={this.upload} isLoading={this.busy && !this.uploadId} disabled={!this.file || this.uploadId !== null} icon={<FrameworkIcons.Upload size={14} />}>
                {this.uploadId ? 'Uploaded' : 'Upload and read'}
              </Button>
              {this.busy && !this.uploadId && this.file ? <span className="fc-sites__text">{this.uploadPercent}%</span> : null}
            </div>
          </Card>

          {this.uploadId && !result ? (
            <Card title="2. Identity on this platform">
              <SiteForm theme={this.theme} values={this.values} onChange={this.onChange} isNew />
              <div className="fc-sites__actions">
                <Button variant={ButtonVariant.OUTLINE} onClick={this.preview} isLoading={this.busy} icon={<FrameworkIcons.Eye size={14} />}>Preview</Button>
              </div>
            </Card>
          ) : null}

          {this.plan && !result ? (
            <Card title="3. What the import will do">
              <ImportPlanView plan={this.plan} />
              <div className="fc-sites__actions">
                <Button onClick={this.execute} isLoading={this.busy} disabled={!this.plan.canExecute} icon={<FrameworkIcons.Download size={14} />}>
                  {this.plan.canExecute ? 'Import this site' : 'Resolve the blockers first'}
                </Button>
              </div>
            </Card>
          ) : null}

          {result ? (
            <Card title="Imported">
              <p className="fc-sites__text">
                <strong>{result.tenant?.slug}</strong> — {result.totalRows} rows, {result.members} members, plugins {(result.pluginsEnabled ?? []).join(', ') || 'none'}, theme {result.themeActivated ?? 'none'}.
                {(result.remappedTables ?? []).length ? ` Re-numbered: ${result.remappedTables.join(', ')}.` : ' Every id was preserved.'}
              </p>
              {(result.warnings ?? []).length ? <ul className="fc-sites__warnings">{result.warnings.map((w: string) => <li key={w}>{w}</li>)}</ul> : null}
              <div className="fc-sites__actions">
                <Button href={AdminConstants.ROUTES.SITES.DETAIL(String(result.tenant?.id ?? ''))} icon={<FrameworkIcons.Settings size={14} />}>Open the site</Button>
              </div>
            </Card>
          ) : null}
        </div>
        </div>
      </div>
    );
  }
}

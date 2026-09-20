import type { ReactNode } from 'react';
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
import { ImportStepDone } from '@/app/sites/import/import-step-done.client';
import { FileDropzone } from '@/components/ui/view/file-dropzone.client';

/**
 * Import a site archive: upload → identity → PREVIEW → execute.
 *
 * The preview is not optional. It is the only place the operator learns which tables will be
 * re-numbered, which plugins/themes are missing here, which people already have accounts — before a
 * row is written. Execute is enabled only after a preview with no blockers.
 *
 * Each step collapses to one line once it is answered, so the plan — the one thing that needs
 * reading — is not pushed below two screens of spent form. Reopening a step clears the plan, because
 * a plan describes the archive and identity it was made from and nothing else.
 */
export class ImportSitePageClient extends AdminComponent {
  @state file: File | null = null;
  @state uploadId: string | null = null;
  @state uploadPercent = 0;
  @state values: SiteFormValues = SiteFormValues.empty();
  @state plan: Record<string, any> | null = null;
  @state result: Record<string, any> | null = null;
  @state busy = false;
  @state editingIdentity = false;

  @bound onFile(file: File | null): void {
    this.file = file;
    // A new archive invalidates everything read from the old one — an operator who swaps the file
    // must not be looking at the previous archive's plan while the button says Execute.
    this.uploadId = null;
    this.uploadPercent = 0;
    this.plan = null;
    this.result = null;
    this.editingIdentity = false;
  }

  @bound onChange(values: SiteFormValues): void {
    this.values = values;
    this.plan = null;
  }

  @bound editIdentity(): void {
    this.editingIdentity = true;
  }

  @bound replaceArchive(): void {
    this.onFile(null);
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
      // NON-PRODUCTION, shown as the preselected answer. `SiteFormValues.empty()` is the NEW-site
      // default, and a new site is a real one — but an import is a COPY of a working shop: real
      // customers in the rows, real payment and courier credentials in the settings. The server
      // already refuses to assume otherwise; this makes the screen say the same thing, so the
      // operator reads what will actually happen rather than "Production" followed by a site that
      // is not.
      this.values = SiteFormValues.empty().with({
        slug: String(archived.slug ?? ''),
        id: String(archived.slug ?? ''),
        primaryHost: String(archived.primaryHost ?? ''),
        hostAliases: (archived.hostAliases ?? []).join(', '),
        environment: 'non-production',
      });
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
      this.editingIdentity = false;
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

  /** What the collapsed identity line says it was answered with — the values the plan was made from. */
  private get identityValue(): string {
    const values = this.values;
    return [values.slug, values.primaryHost, values.environment].filter(Boolean).join(' · ');
  }

  private renderArchiveStep(): ReactNode {
    if (this.uploadId && !this.result) {
      return <ImportStepDone title="Archive" value={`${this.file?.name ?? 'archive'} — read`} actionLabel="Replace" onAction={this.replaceArchive} />;
    }
    if (this.result) return null;
    return (
      <Card title="1. Archive">
        <div className="fc-sites__upload">
          <FileDropzone
            accept=".tar.gz,.tgz"
            file={this.file}
            onSelect={this.onFile}
            percent={this.uploadPercent}
            busy={this.busy && !this.uploadId}
            disabled={this.uploadId !== null}
            hint="A .tar.gz archive exported from this platform, or written by the tenant-export CLI."
          />
          <div className="fc-sites__actions">
            <Button onClick={this.upload} isLoading={this.busy && !this.uploadId} disabled={!this.file || this.uploadId !== null} icon={<FrameworkIcons.Upload size={14} />}>
              Upload and read
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  private renderIdentityStep(): ReactNode {
    if (!this.uploadId || this.result) return null;
    // Collapsed only once a plan exists for these values: with no plan there is nothing below to
    // read, so hiding the form would leave the operator on a page with nothing to do.
    if (this.plan && !this.editingIdentity) {
      return <ImportStepDone title="Identity" value={this.identityValue} actionLabel="Edit" onAction={this.editIdentity} />;
    }
    return (
      <Card title="2. Identity on this platform">
        <SiteForm theme={this.theme} values={this.values} onChange={this.onChange} isNew />
        <div className="fc-sites__actions">
          <Button variant={ButtonVariant.OUTLINE} onClick={this.preview} isLoading={this.busy} icon={<FrameworkIcons.Eye size={14} />}>Preview</Button>
        </div>
      </Card>
    );
  }

  private renderPlan(): ReactNode {
    const plan = this.plan;
    if (!plan || this.result) return null;
    const blockers: string[] = plan.blockers ?? [];
    return (
      <Card className="fc-import-card" noPadding>
        <div className="fc-import-card__head">
          <div>
            <div className="fc-import-card__title">What this import will do</div>
          </div>
          <span className={`fc-import-card__pill fc-import-card__pill--${plan.canExecute ? 'ready' : 'blocked'}`}>
            <span className="fc-import-card__pill-dot" aria-hidden="true" />
            {plan.canExecute ? 'Ready to import' : `${blockers.length} blocker(s)`}
          </span>
        </div>
        <div className="fc-import-card__body">
          <ImportPlanView plan={plan} />
        </div>
        <div className="fc-import-card__foot">
          <span className="fc-import-card__foot-text">
            {plan.canExecute
              ? <>Creates <b>{this.values.slug}</b> as a {this.values.environment} site. Nothing already on this platform is touched.</>
              : <>Resolve the blocker(s) above, then preview again.</>}
          </span>
          <Button onClick={this.execute} isLoading={this.busy} disabled={!plan.canExecute} icon={<FrameworkIcons.Download size={14} />}>
            Import this site
          </Button>
        </div>
      </Card>
    );
  }

  private renderResult(): ReactNode {
    const result = this.result;
    if (!result) return null;
    return (
      <Card title="Imported">
        <p className="fc-sites__text">
          <strong>{result.tenant?.slug}</strong> — {result.totalRows} rows, {result.members} members, plugins {(result.pluginsEnabled ?? []).join(', ') || 'none'}, theme {result.themeActivated ?? 'none'}.
          {(result.remappedTables ?? []).length ? ` Re-numbered: ${result.remappedTables.join(', ')}.` : ' Every id was preserved.'}
        </p>
        {(result.warnings ?? []).length ? <ul className="fc-sites__warnings">{result.warnings.map((w: string) => <li key={w}>{w}</li>)}</ul> : null}
        {(result.exportWarnings ?? []).length ? (
          <details className="fc-import-plan__warnings">
            <summary>From the export ({result.exportWarnings.length})</summary>
            <p className="fc-import-plan__rule">
              Written into the archive when it was exported. They describe what the archive held, not a decision this import made.
            </p>
            <ul className="fc-sites__warnings">{result.exportWarnings.map((w: string) => <li key={w}>{w}</li>)}</ul>
          </details>
        ) : null}
        <div className="fc-sites__actions">
          <Button href={AdminConstants.ROUTES.SITES.DETAIL(String(result.tenant?.id ?? ''))} icon={<FrameworkIcons.Settings size={14} />}>Open the site</Button>
        </div>
      </Card>
    );
  }

  render(): ReactNode {
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
            {this.renderArchiveStep()}
            {this.renderIdentityStep()}
            {this.renderPlan()}
            {this.renderResult()}
          </div>
        </div>
      </div>
    );
  }
}

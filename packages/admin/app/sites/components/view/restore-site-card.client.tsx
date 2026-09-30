import type { ReactNode } from 'react';
import { bound, state } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Card } from '@/components/ui/view/card.client';
import { FileDropzone } from '@/components/ui/view/file-dropzone.client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { SitesClient } from '@/lib/tenants/sites-client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { AdminRichText } from '@/components/ui/view/admin-rich-text.client';

/**
 * Shown on an installation whose database keeps a SINGLE site: put a site's DATA here.
 *
 * Without this the screen offered nothing that brings a site's content in, so taking a site off the
 * platform onto its own box meant dropping to a shell for the one step in the middle, on a machine
 * whose admin was already running and already authenticated.
 *
 * The rows arrive with NO owner, which is what every row of a single-site installation looks like. A
 * database that keeps sites apart takes the archive through Import instead, as a site.
 */
export class RestoreSiteCard extends AdminComponent {
  @state busy = false;
  @state progress = 0;
  @state passphrase = '';
  @state file: File | null = null;
  @state outcome: { tables: number; rows: number; warnings: string[] } | null = null;

  @bound
  async onFile(file: File | null): Promise<void> {
    if (!file) return;
    this.file = file;

    this.busy = true;
    this.progress = 0;
    try {
      const uploadId = await SitesClient.uploadArchive(file, (percent) => { this.progress = percent; });
      this.outcome = await SitesClient.restoreStandalone(uploadId, this.passphrase);
      this.runtime.notify.addNotification({
        title: AdminI18n.t('sites.archiveRestored'),
        message: AdminI18n.t('sites.rowsAcrossTablesRestored', { toLocaleString: this.outcome.rows.toLocaleString(), tables: this.outcome.tables }),
        type: NotificationType.INFO,
      });
    } catch (err: any) {  // eslint-disable-line @typescript-eslint/no-explicit-any
      this.runtime.notify.addNotification({
        title: AdminI18n.t('sites.restoreFailed'),
        message: err?.message || AdminI18n.t('sites.nothingWasWrittenTheRestore'),
        type: NotificationType.ERROR,
      });
    } finally {
      this.busy = false;
    }
  }

  render(): ReactNode {
    if (this.outcome) {
      return (
        <Card title={AdminI18n.t('sites.restored')} icon={<FrameworkIcons.CheckCircle size={16} />}>
          <p className="fc-sites__text">
            <AdminRichText k="sites.restoredOutcome" vars={{ rows: this.outcome.rows.toLocaleString(), tables: this.outcome.tables }} />
          </p>
          {this.outcome.warnings.map((warning) => (
            <p key={warning} className="fc-sites__text fc-sites__text--warn">{warning}</p>
          ))}
        </Card>
      );
    }

    return (
      <Card title={AdminI18n.t('sites.restoreASiteFromAn')} icon={<FrameworkIcons.Upload size={16} />}>
        <p className="fc-sites__text">
          {AdminI18n.t('sites.bringASiteExportedFrom')}
        </p>
        <div className="fc-import-card__passphrase">
          <label className="fc-import-card__passphrase-label" htmlFor="fc-restore-passphrase">
            {AdminI18n.t('sites.transitPassphraseOnlyIfThe')}
          </label>
          <input
            id="fc-restore-passphrase"
            type="password"
            autoComplete="off"
            className="fc-import-card__passphrase-input"
            value={this.passphrase}
            onChange={(event) => { this.passphrase = (event.target as HTMLInputElement).value; }}
            disabled={this.busy}
          />
        </div>
        <div className="fc-sites__upload">
          <FileDropzone
            accept=".tar.gz,.tgz"
            file={this.file}
            onSelect={this.onFile}
            percent={this.progress}
            busy={this.busy}
            disabled={this.busy}
            hint={AdminI18n.t('sites.importPlan.aTarGzArchiveExported')}
          />
        </div>
      </Card>
    );
  }
}

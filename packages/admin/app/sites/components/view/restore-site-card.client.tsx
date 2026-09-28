import type { ReactNode } from 'react';
import { bound, state } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Button } from '@/components/ui/view/button.client';
import { Card } from '@/components/ui/view/card.client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { SitesClient } from '@/lib/tenants/sites-client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { AdminRichText } from '@/components/ui/view/admin-rich-text.client';

/**
 * Shown beside "adopt" on a deployment with NO sites: put a site's DATA here first.
 *
 * Without this the screen offered exactly one thing — adopt this empty installation as a site — and
 * nothing that brings a site's content in. Taking a site off the platform onto its own box therefore
 * meant dropping to a shell for the one step in the middle, on a machine whose admin was already
 * running and already authenticated.
 *
 * The rows arrive with NO owner, which is what every row of a deployment with no sites looks like.
 * Adopting afterwards stamps them with the new site and asks for the restart that turns tenancy on —
 * the order matters, which is why this deliberately does not create a site itself.
 */
export class RestoreSiteCard extends AdminComponent {
  @state busy = false;
  @state progress = 0;
  @state passphrase = '';
  @state outcome: { tables: number; rows: number; warnings: string[] } | null = null;

  declare props: { onRestored: () => void };

  @bound
  async onFile(event: { target: { files: FileList | null } }): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;

    this.busy = true;
    this.progress = 0;
    try {
      const uploadId = await SitesClient.uploadArchive(file, (percent) => { this.progress = percent; });
      this.outcome = await SitesClient.restoreStandalone(uploadId, this.passphrase);
      this.runtime.notify.addNotification({
        title: AdminI18n.t('sites.archiveRestored'),
        message: AdminI18n.t('sites.rowsAcrossTablesAdoptThis', { toLocaleString: this.outcome.rows.toLocaleString(), tables: this.outcome.tables }),
        type: NotificationType.INFO,
      });
      this.props.onRestored();
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
        <Card title={AdminI18n.t('sites.restoredAdoptNext')} icon={<FrameworkIcons.CheckCircle size={16} />}>
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
        <label className="fc-sites__text" htmlFor="fc-restore-passphrase">
          {AdminI18n.t('sites.transitPassphraseOnlyIfThe')}
        </label>
        <input
          id="fc-restore-passphrase"
          type="password"
          value={this.passphrase}
          onChange={(event) => { this.passphrase = (event.target as HTMLInputElement).value; }}
          disabled={this.busy}
        />
        <div className="fc-sites__actions">
          <input type="file" accept=".tar.gz,.tgz" onChange={this.onFile} disabled={this.busy} />
          {this.busy ? <Button isLoading disabled>{AdminI18n.t('sites.restoringProgress', { progress: this.progress })}</Button> : null}
        </div>
      </Card>
    );
  }
}

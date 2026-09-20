import type { ReactNode } from 'react';
import { bound, state } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Button } from '@/components/ui/view/button.client';
import { Card } from '@/components/ui/view/card.client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { SitesClient } from '@/lib/tenants/sites-client';

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
        title: 'Archive restored',
        message: `${this.outcome.rows.toLocaleString()} rows across ${this.outcome.tables} tables. Adopt this deployment to make it the site.`,
        type: NotificationType.INFO,
      });
      this.props.onRestored();
    } catch (err: any) {  // eslint-disable-line @typescript-eslint/no-explicit-any
      this.runtime.notify.addNotification({
        title: 'Restore failed',
        message: err?.message || 'Nothing was written — the restore is one transaction.',
        type: NotificationType.ERROR,
      });
    } finally {
      this.busy = false;
    }
  }

  render(): ReactNode {
    if (this.outcome) {
      return (
        <Card title="Restored — adopt next" icon={<FrameworkIcons.CheckCircle size={16} />}>
          <p className="fc-sites__text">
            {this.outcome.rows.toLocaleString()} rows across {this.outcome.tables} tables are here, with no owner yet — which is
            correct for a deployment with no sites. <strong>Adopt this deployment below</strong> to stamp them with the new site,
            then restart the API.
          </p>
          {this.outcome.warnings.map((warning) => (
            <p key={warning} className="fc-sites__text fc-sites__text--warn">{warning}</p>
          ))}
        </Card>
      );
    }

    return (
      <Card title="Restore a site from an archive" icon={<FrameworkIcons.Upload size={16} />}>
        <p className="fc-sites__text">
          Bring a site exported from another platform onto this installation. The rows arrive owned by nobody, which is what a
          deployment with no sites looks like — adopting afterwards gives them their owner. Nothing is written unless the whole
          archive fits: the restore is one transaction.
        </p>
        <label className="fc-sites__text" htmlFor="fc-restore-passphrase">
          Transit passphrase — only if the export sealed its secrets
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
          {this.busy ? <Button isLoading disabled>Restoring… {this.progress}%</Button> : null}
        </div>
      </Card>
    );
  }
}

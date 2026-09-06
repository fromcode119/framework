import type { ReactNode } from 'react';
import { bound, prop, state } from '@fromcode119/reactor';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { Card } from '@/components/ui/view/card.client';
import { PromptDialog } from '@/components/ui/view/prompt-dialog.client';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { SiteRecord } from '@/lib/tenants/site-record';
import { SitesClient } from '@/lib/tenants/sites-client';

/** Delete. An export is written FIRST, every time; the typed slug is the confirmation. */
export class SiteDangerCard extends AdminComponent {
  @prop declare site: SiteRecord;
  @prop declare onDeleted: () => void;

  @state open = false;
  @state busy = false;

  @bound ask(): void {
    this.open = true;
  }

  @bound close(): void {
    this.open = false;
  }

  @bound
  async confirm(typed: string): Promise<void> {
    if (typed.trim() !== this.site.slug) {
      this.runtime.notify.addNotification({ title: 'Not deleted', message: `Type "${this.site.slug}" exactly to confirm.`, type: NotificationType.ERROR });
      return;
    }
    this.busy = true;
    try {
      const result = await SitesClient.remove(this.site.id, typed.trim());
      this.open = false;
      this.runtime.notify.addNotification({
        title: 'Site deleted',
        message: `Exported to ${result.archive} first; ${Object.values(result.deleted).reduce((a, b) => a + b, 0)} rows and ${result.files} files removed.`,
        type: NotificationType.INFO,
      });
      this.onDeleted();
    } catch (err: any) {
      this.runtime.notify.addNotification({ title: 'Delete failed', message: err?.message || 'Nothing was deleted.', type: NotificationType.ERROR });
    } finally {
      this.busy = false;
    }
  }

  render(): ReactNode {
    return (
      <Card title="Delete this site" icon={<FrameworkIcons.Warning size={16} />} className="fc-sites__danger">
        <p className="fc-sites__text">
          Removes every row and file that belongs to <strong>{this.site.slug}</strong> and its memberships. Accounts are kept — a person may belong to
          other sites. An export is written to Backups → Sites <em>before</em> anything is removed; it is the only way back.
        </p>
        <div className="fc-sites__actions">
          <Button variant={ButtonVariant.DANGER} onClick={this.ask} icon={<FrameworkIcons.Trash size={14} />}>Export and delete…</Button>
        </div>
        <PromptDialog
          isOpen={this.open}
          onClose={this.close}
          onConfirm={this.confirm}
          title={`Delete ${this.site.slug}?`}
          description={`Type the slug "${this.site.slug}" to confirm. The export is written first.`}
          placeholder={this.site.slug}
          confirmLabel="Export and delete"
          isLoading={this.busy}
          icon={<FrameworkIcons.Trash size={16} />}
        />
      </Card>
    );
  }
}

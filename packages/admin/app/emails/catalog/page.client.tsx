import type { ReactNode } from 'react';
import { bound, state } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { ListShell } from '@/components/ui/view/list-shell.client';
import { DataTable } from '@/components/ui/view/data-table.client';
import { AdminApi } from '@/lib/api';
import { AdminClass } from '@/lib/admin-class';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { EmailSenderText } from '@/app/emails/email-sender-text';
import { EmailColumns } from '@/app/emails/email-columns';
import { EmailCatalogText } from '@/app/emails/email-catalog-text';

/**
 * The email catalog — every kind of email this site (or the platform) can send: what it is, who sends
 * it, WHEN it goes out and how often it went out lately. A row opens the email drawn with its example
 * data. Before this, an operator learnt an email existed when a customer received it.
 */
export class EmailCatalogPage extends AdminComponent {
  @state private templates: any[] = [];
  @state private loading = true;
  @state private failed = false;

  componentDidMount(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const response = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.EMAILS.CATALOG);
      const rows = Array.isArray(response?.templates) ? response.templates : [];
      this.templates = rows.sort((a: any, b: any) => EmailSenderText.of(a.sender).localeCompare(EmailSenderText.of(b.sender)) || EmailCatalogText.label(a).localeCompare(EmailCatalogText.label(b)));
    } catch {
      this.failed = true;
    } finally {
      this.loading = false;
    }
  }

  @bound private open(row: any): void {
    this.router.push(`${AdminConstants.ROUTES.EMAILS_CATALOG}/${encodeURIComponent(String(row.id))}`);
  }

  private get columns(): Array<{ header: string; id: string; className?: string; accessor: (row: any) => ReactNode }> {
    return [
      { header: AdminI18n.t('emails.catalog.columns.email'), id: 'email', accessor: (row) => <span className="fc-dt-strong">{EmailCatalogText.label(row)}</span> },
      { header: AdminI18n.t('emails.catalog.columns.when'), id: 'when', className: 'fc-dt-fill fc-dt-wrap', accessor: (row) => EmailCatalogText.trigger(row) },
      { header: AdminI18n.t('emails.columns.sender'), id: 'sender', accessor: (row) => EmailSenderText.of(row.sender) },
      { header: AdminI18n.t('emails.fields.category'), id: 'category', accessor: (row) => row.category || AdminI18n.t('emails.transactional') },
      { header: AdminI18n.t('emails.catalog.columns.sent', { days: 30 }), id: 'sent', accessor: (row) => String(row.sentLastWindow ?? 0) },
      { header: AdminI18n.t('emails.catalog.columns.lastSent'), id: 'last', accessor: (row) => (row.lastSentAt ? EmailColumns.time(row.lastSentAt) : <span className="fc-dt-quiet">{AdminI18n.t('emails.catalog.neverSent')}</span>) },
    ];
  }

  render(): ReactNode {
    return (
      <div className={`w-full ${AdminClass.of('settings-page')}`}>
        <CompactPageHeader
          theme={this.theme}
          backHref={AdminConstants.ROUTES.EMAILS}
          icon={<FrameworkIcons.Mail size={18} strokeWidth={2.5} />}
          title={AdminI18n.t('emails.catalog.title')}
          subtitle={AdminI18n.t('emails.catalog.subtitle')}
        />
        <div className="w-full py-6 fc-page-stack">
          <ListShell count={this.loading ? null : this.templates.length}>
            <DataTable
              columns={this.columns as any}
              data={this.templates}
              onRowClick={this.open}
              emptyMessage={this.loading ? AdminI18n.t('emails.loading') : this.failed ? AdminI18n.t('emails.failed') : AdminI18n.t('emails.catalog.empty')}
            />
          </ListShell>
        </div>
      </div>
    );
  }
}

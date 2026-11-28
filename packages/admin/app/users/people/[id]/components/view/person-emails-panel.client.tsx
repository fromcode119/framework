import type { ReactNode } from 'react';
import { bound, prop, state, watch } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';
import { RecordCard } from '@/components/ui/view/record-card.client';
import { DataTable } from '@/components/ui/view/data-table.client';
import { AdminFactGrid } from '@/components/ui/view/admin-fact-grid.client';
import { Button } from '@/components/ui/view/button.client';
import { Hint } from '@/components/ui/view/hint.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { AdminLink } from '@/components/view/admin-link.client';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { EmailColumns } from '@/app/emails/email-columns';

/**
 * Every email this site sent the person, newest first, and the streams they asked not to receive.
 * The opt-outs are shown, not editable: lifting one is the person's own choice, on their preferences page.
 */
export class PersonEmailsPanel extends AdminComponent {
  private static readonly SHOWN = 10;

  @prop declare address: string;

  @state private emails: any[] = [];
  @state private suppressions: any[] = [];
  @state private loading = true;
  @state private failed = false;

  componentDidMount(): void {
    void this.load();
  }

  @watch('address') private onAddress(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    const address = String(this.address || '').trim();
    this.loading = true;
    this.failed = false;
    if (!address) {
      this.emails = [];
      this.suppressions = [];
      this.loading = false;
      return;
    }
    try {
      const query = `?address=${encodeURIComponent(address)}`;
      const [list, opted] = await Promise.all([
        AdminApi.get(`${AdminConstants.ENDPOINTS.SYSTEM.EMAILS.LIST}${query}`),
        AdminApi.get(`${AdminConstants.ENDPOINTS.SYSTEM.EMAILS.SUPPRESSIONS}${query}`),
      ]);
      this.emails = Array.isArray(list?.emails) ? list.emails : [];
      this.suppressions = Array.isArray(opted?.suppressions) ? opted.suppressions : [];
    } catch {
      this.failed = true;
    } finally {
      this.loading = false;
    }
  }

  @bound private open(row: any): void {
    this.router.push(`${AdminConstants.ROUTES.EMAILS}/${encodeURIComponent(String(row.id))}`);
  }

  private get columns(): any[] {
    return EmailColumns.all().filter((column) => column.id !== 'to');
  }

  private get emptyMessage(): string {
    if (this.loading) return AdminI18n.t('emails.loading');
    if (this.failed) return AdminI18n.t('emails.failed');
    return String(this.address || '').trim() ? AdminI18n.t('emails.person.none') : AdminI18n.t('emails.person.noAddress');
  }

  private renderSuppressions(): ReactNode {
    if (!this.suppressions.length) return null;
    return (
      <AdminFactGrid
        facts={this.suppressions.map((row, index) => ({
          key: `${row.category}-${index}`,
          label: row.category === 'all' ? AdminI18n.t('emails.person.allMail') : String(row.category),
          value: EmailColumns.time(row.createdAt),
          note: row.source ? String(row.source) : undefined,
        }))}
        lockLabel={AdminI18n.t('emails.person.optOutsHint')}
      />
    );
  }

  render(): ReactNode {
    const address = String(this.address || '').trim();
    return (
      <RecordCard
        title={AdminI18n.t('emails.person.heading')}
        count={this.loading ? null : this.emails.length}
        aside={address ? (
          <Button variant={ButtonVariant.SECONDARY} as={AdminLink} href={`${AdminConstants.ROUTES.EMAILS}?address=${encodeURIComponent(address)}`}>
            {AdminI18n.t('emails.person.seeAll')}
          </Button>
        ) : undefined}
      >
        <div className="fc-stack">
          {this.suppressions.length ? <Hint>{AdminI18n.t('emails.person.optedOut')}</Hint> : null}
          {this.renderSuppressions()}
          <DataTable columns={this.columns} data={this.emails.slice(0, PersonEmailsPanel.SHOWN)} onRowClick={this.open} emptyMessage={this.emptyMessage} />
        </div>
      </RecordCard>
    );
  }
}

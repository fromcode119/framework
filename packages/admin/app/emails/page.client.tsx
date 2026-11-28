import type { ReactNode } from 'react';
import { bound, state, watch } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { ListShell } from '@/components/ui/view/list-shell.client';
import { DataTable } from '@/components/ui/view/data-table.client';
import { Tabs } from '@/components/ui/view/tabs.client';
import { SearchField } from '@/components/ui/view/search-field.client';
import { Select } from '@/components/ui/view/select.client';
import { Button } from '@/components/ui/view/button.client';
import { Alert } from '@/components/ui/view/alert.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { AdminLink } from '@/components/view/admin-link.client';
import { AdminApi } from '@/lib/api';
import { AdminClass } from '@/lib/admin-class';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { EmailColumns } from '@/app/emails/email-columns';
import { EmailTemplateNames } from '@/app/emails/email-template-names';
import { EmailSenderText } from '@/app/emails/email-sender-text';

/**
 * Emails — every email this site (or, in the platform scope, the platform) sent, refused to send
 * because the person opted out, or failed to send. One row per recipient, newest first; a row opens
 * the email itself. Before this, mail left with no record an operator could see.
 */
export class EmailsPage extends AdminComponent {
  private static readonly STATUSES = ['', 'sent', 'suppressed', 'failed', 'bounced', 'complained'];
  /** The value the API's sender filter uses for mail the platform itself sent. */
  private static readonly PLATFORM = 'platform';
  private static readonly PAGE = 100;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  @state private emails: any[] = [];
  @state private senders: string[] = [];
  @state private platformScope = false;
  /** Whether bounces are read for this scope, and how the last read went (`bounceMailbox` of the list). */
  @state private bounce: any = null;
  @state private loading = true;
  @state private failed = false;
  @state private more = false;
  @state private status = '';
  @state private sender = '';
  /** Hours back from now, or '' for every email. */
  @state private period = '';
  @state private address = '';
  @state private activeAddress = '';
  /** Opened from the catalog: only this kind of email. Stated above the list, with a way back to all. */
  @state private template = '';
  @state private templateNames = new Map<string, string>();

  componentDidMount(): void {
    void EmailTemplateNames.load().then((names) => { this.templateNames = names; });
    const search = new URLSearchParams(window.location.search);
    this.activeAddress = this.address = search.get('address') || '';
    this.template = search.get('template') || '';
    void this.load();
  }

  componentWillUnmount(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
  }

  @watch('status', 'sender', 'activeAddress', 'template', 'period') private reload(): void {
    void this.load();
  }

  private query(before?: number): string {
    const params = new URLSearchParams();
    if (this.status) params.set('status', this.status);
    if (this.sender) params.set('sender', this.sender);
    if (this.activeAddress.trim()) params.set('address', this.activeAddress.trim());
    if (this.template) params.set('template', this.template);
    if (this.period) params.set('since', new Date(Date.now() - Number(this.period) * 3_600_000).toISOString());
    if (before) params.set('before', String(before));
    const text = params.toString();
    return text ? `?${text}` : '';
  }

  private async load(before?: number): Promise<void> {
    this.loading = true;
    this.failed = false;
    try {
      const response = await AdminApi.get(`${AdminConstants.ENDPOINTS.SYSTEM.EMAILS.LIST}${this.query(before)}`);
      const rows = Array.isArray(response?.emails) ? response.emails : [];
      this.platformScope = response?.scope === 'platform';
      this.senders = Array.isArray(response?.senders) ? response.senders : [];
      this.bounce = response?.bounceMailbox ?? null;
      this.emails = before ? [...this.emails, ...rows] : rows;
      this.more = rows.length === EmailsPage.PAGE;
    } catch {
      this.failed = true;
    } finally {
      this.loading = false;
    }
  }

  @bound private onStatus(value: string): void {
    this.status = value === 'all' ? '' : value;
  }

  @bound private onSender(value: string): void {
    this.sender = value;
  }

  @bound private onPeriod(value: string): void {
    this.period = value;
  }

  @bound private onAddress(value: string): void {
    this.address = value;
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => { this.activeAddress = this.address; }, 300);
  }

  @bound private clearTemplate(): void {
    this.template = '';
  }

  @bound private loadOlder(): void {
    const last = this.emails[this.emails.length - 1];
    if (last) void this.load(Number(last.id));
  }

  @bound private open(row: any): void {
    this.router.push(`${String(this.pathname || '').replace(/\/$/, '')}/${encodeURIComponent(String(row.id))}`);
  }

  private get senderOptions(): Array<{ value: string; label: string }> {
    return [
      { value: '', label: AdminI18n.t('emails.filters.allSenders') },
      ...this.senders.map((value) => ({ value, label: value === EmailsPage.PLATFORM ? AdminI18n.t('emails.platform') : EmailSenderText.of(value) })),
    ];
  }

  /** Bounces are tracked only where a bounce mailbox is set; the page says which, and how reading went. */
  private renderBounceNote(): ReactNode {
    const bounce = this.bounce;
    if (!bounce) return null;
    const settings = <AdminLink href={AdminConstants.ROUTES.SETTINGS.INTEGRATIONS_BY_TYPE('email')}>{AdminI18n.t('emails.bounces.settingsLink')}</AdminLink>;
    if (!bounce.configured) return <Alert tone="info" action={settings}>{AdminI18n.t('emails.bounces.notConfigured')}</Alert>;
    if (bounce.error) return <Alert tone="danger" action={settings}>{AdminI18n.t('emails.bounces.failed', { error: bounce.error })}</Alert>;
    return bounce.readAt
      ? <p className="fc-dt-quiet">{AdminI18n.t('emails.bounces.lastRead', { date: EmailColumns.time(bounce.readAt) })}</p>
      : <p className="fc-dt-quiet">{AdminI18n.t('emails.bounces.notReadYet')}</p>;
  }

  private get emptyMessage(): string {
    if (this.loading) return AdminI18n.t('emails.loading');
    if (this.failed) return AdminI18n.t('emails.failed');
    return this.status || this.sender || this.activeAddress || this.template || this.period ? AdminI18n.t('emails.emptyFiltered') : AdminI18n.t('emails.empty');
  }

  render(): ReactNode {
    return (
      <div className={`w-full ${AdminClass.of('settings-page')}`}>
        <CompactPageHeader
          theme={this.theme}
          icon={<FrameworkIcons.Mail size={18} strokeWidth={2.5} />}
          title={AdminI18n.t('emails.title')}
          subtitle={this.platformScope ? AdminI18n.t('emails.subtitlePlatform') : AdminI18n.t('emails.subtitleSite')}
          actions={<Button variant={ButtonVariant.SECONDARY} as={AdminLink} href={AdminConstants.ROUTES.EMAILS_CATALOG}>{AdminI18n.t('emails.catalog.open')}</Button>}
        />
        <div className="w-full py-6 fc-page-stack">
          {this.renderBounceNote()}
          <ListShell
            subtitle={this.template ? (
              <span className="fc-dt-inline">
                {AdminI18n.t('emails.filters.onlyTemplate', { template: EmailTemplateNames.of(this.templateNames, this.template) })}
                <Button variant={ButtonVariant.GHOST} onClick={this.clearTemplate}>{AdminI18n.t('emails.filters.showAll')}</Button>
              </span>
            ) : undefined}
            lead={(
              <Tabs
                label={AdminI18n.t('emails.columns.status')}
                value={this.status || 'all'}
                onChange={this.onStatus}
                tabs={EmailsPage.STATUSES.map((id) => ({ id: id || 'all', label: id ? AdminI18n.t(`emails.status.${id}`) : AdminI18n.t('emails.filters.all') }))}
              />
            )}
            tools={(
              <>
                <Select value={this.sender} onChange={this.onSender} options={this.senderOptions} label={AdminI18n.t('emails.columns.sender')} />
                <Select
                  value={this.period}
                  onChange={this.onPeriod}
                  label={AdminI18n.t('emails.filters.period')}
                  options={[
                    { value: '', label: AdminI18n.t('emails.filters.anyTime') },
                    { value: '24', label: AdminI18n.t('emails.filters.lastDay') },
                    { value: '168', label: AdminI18n.t('emails.filters.lastWeek') },
                    { value: '720', label: AdminI18n.t('emails.filters.lastMonth') },
                  ]}
                />
                <SearchField value={this.address} onChange={this.onAddress} placeholder={AdminI18n.t('emails.filters.address')} />
              </>
            )}
            foot={this.more ? <Button variant={ButtonVariant.SECONDARY} isLoading={this.loading} onClick={this.loadOlder}>{AdminI18n.t('emails.loadOlder')}</Button> : null}
          >
            <DataTable columns={EmailColumns.all(this.templateNames) as any} data={this.emails} onRowClick={this.open} emptyMessage={this.emptyMessage} />
          </ListShell>
        </div>
      </div>
    );
  }
}

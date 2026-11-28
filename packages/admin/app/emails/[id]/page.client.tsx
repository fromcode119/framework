import type { ReactNode } from 'react';
import { bound, prop, state } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { RecordCard } from '@/components/ui/view/record-card.client';
import { AdminFactGrid } from '@/components/ui/view/admin-fact-grid.client';
import { Alert } from '@/components/ui/view/alert.client';
import { Button } from '@/components/ui/view/button.client';
import { ConfirmDialog } from '@/components/ui/view/confirm-dialog.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { AdminApi } from '@/lib/api';
import { AdminClass } from '@/lib/admin-class';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { EmailStatusBadge } from '@/app/emails/email-status-badge';
import { EmailSenderText } from '@/app/emails/email-sender-text';
import { EmailColumns } from '@/app/emails/email-columns';
import { EmailTemplateNames } from '@/app/emails/email-template-names';

/**
 * One email: everything recorded about it, the email itself as it was sent, and "send it again".
 *
 * The content is shown only while it is kept. A message carrying a sign-in or reset link is never
 * stored, and the content retention setting empties older ones; the page then says which, and when.
 */
export class EmailPage extends AdminComponent {
  @prop declare params: Promise<{ id: string }>;

  @state private email: any = null;
  @state private error = '';
  @state private confirming = false;
  @state private resending = false;
  @state private templateNames = new Map<string, string>();

  async componentDidMount(): Promise<void> {
    void EmailTemplateNames.load().then((names) => { this.templateNames = names; });
    const params = await this.params;
    try {
      const response = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.EMAILS.ONE(decodeURIComponent(params.id)));
      this.email = response?.email ?? null;
      if (!this.email) this.error = AdminI18n.t('emails.notFound');
    } catch (error: any) {
      this.error = error?.status === 403 ? AdminI18n.t('emails.manageRequired') : AdminI18n.t('emails.failed');
    }
  }

  private get listHref(): string {
    return String(this.pathname || '').replace(/\/[^/]+\/?$/, '') || '/';
  }

  @bound private openConfirm(): void {
    this.confirming = true;
  }

  @bound private closeConfirm(): void {
    this.confirming = false;
  }

  @bound private async resend(): Promise<void> {
    const notify = this.runtime.notify.addNotification;
    this.resending = true;
    try {
      const result = await AdminApi.post(AdminConstants.ENDPOINTS.SYSTEM.EMAILS.RESEND(this.email.id), {});
      notify(result?.skipped
        ? { title: AdminI18n.t('emails.resend.skippedTitle'), message: AdminI18n.t('emails.resend.skipped', { address: this.email.to }), type: NotificationType.INFO }
        : { title: AdminI18n.t('emails.resend.sentTitle'), message: AdminI18n.t('emails.resend.sent', { address: this.email.to }), type: NotificationType.SUCCESS });
    } catch (error: any) {
      notify({ title: AdminI18n.t('emails.resend.failedTitle'), message: error?.message || AdminI18n.t('emails.resend.failed'), type: NotificationType.ERROR });
    } finally {
      this.resending = false;
      this.confirming = false;
    }
  }

  private get facts(): Array<{ key: string; label: string; value: ReactNode }> {
    const email = this.email;
    const facts: Array<{ key: string; label: string; value: ReactNode }> = [
      { key: 'status', label: AdminI18n.t('emails.columns.status'), value: <EmailStatusBadge status={String(email.status)} /> },
      { key: 'sentAt', label: AdminI18n.t('emails.columns.sentAt'), value: EmailColumns.time(email.createdAt) },
      { key: 'to', label: AdminI18n.t('emails.columns.to'), value: email.to },
      { key: 'subject', label: AdminI18n.t('emails.columns.subject'), value: email.subject },
      { key: 'sender', label: AdminI18n.t('emails.columns.sender'), value: EmailSenderText.of(email.sender) },
      { key: 'template', label: AdminI18n.t('emails.columns.template'), value: email.template ? EmailTemplateNames.of(this.templateNames, email.template) : AdminI18n.t('emails.noTemplate') },
      { key: 'category', label: AdminI18n.t('emails.fields.category'), value: email.category || AdminI18n.t('emails.transactional') },
    ];
    if (email.error) facts.push({ key: 'error', label: AdminI18n.t('emails.fields.error'), value: email.error });
    if (email.smtpResponse) facts.push({ key: 'smtp', label: AdminI18n.t('emails.fields.serverAnswer'), value: email.smtpResponse });
    if (email.messageId) facts.push({ key: 'messageId', label: AdminI18n.t('emails.fields.messageId'), value: email.messageId });
    if (email.schedulerRunId) facts.push({ key: 'run', label: AdminI18n.t('emails.fields.jobRun'), value: `#${email.schedulerRunId}` });
    return facts;
  }

  private renderContent(): ReactNode {
    const email = this.email;
    if (email.contentRemovedAt) {
      return <Alert tone="info">{AdminI18n.t('emails.contentRemoved', { date: EmailColumns.time(email.contentRemovedAt) })}</Alert>;
    }
    if (email.html) return <iframe title={email.subject} sandbox="" srcDoc={email.html} className="fc-email-preview" />;
    if (email.text) return <pre className="fc-email-preview fc-email-preview--text">{email.text}</pre>;
    return <Alert tone="info">{AdminI18n.t('emails.noContent')}</Alert>;
  }

  render(): ReactNode {
    const email = this.email;
    const canResend = Boolean(email && !email.contentRemovedAt && (email.html || email.text));
    return (
      <div className={`w-full ${AdminClass.of('settings-page')}`}>
        <CompactPageHeader
          theme={this.theme}
          backHref={this.listHref}
          icon={<FrameworkIcons.Mail size={18} strokeWidth={2.5} />}
          title={email?.subject || AdminI18n.t('emails.title')}
          subtitle={email ? email.to : AdminI18n.t('emails.title')}
        />
        <div className="w-full py-6 fc-page-stack">
          {this.error ? <Alert tone="danger">{this.error}</Alert> : null}
          {email ? (
            <>
              <RecordCard
                title={AdminI18n.t('emails.detailHeading')}
                aside={canResend ? <Button variant={ButtonVariant.SECONDARY} onClick={this.openConfirm}>{AdminI18n.t('emails.resend.button')}</Button> : undefined}
              >
                <AdminFactGrid facts={this.facts} />
              </RecordCard>
              <RecordCard title={AdminI18n.t('emails.contentHeading')}>{this.renderContent()}</RecordCard>
              <ConfirmDialog
                isOpen={this.confirming}
                onClose={this.closeConfirm}
                onConfirm={this.resend}
                isLoading={this.resending}
                title={AdminI18n.t('emails.resend.confirmTitle')}
                description={AdminI18n.t('emails.resend.confirm', { address: email.to })}
                confirmLabel={AdminI18n.t('emails.resend.button')}
              />
            </>
          ) : null}
        </div>
      </div>
    );
  }
}

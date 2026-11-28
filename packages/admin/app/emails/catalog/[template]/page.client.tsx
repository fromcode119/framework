import type { ReactNode } from 'react';
import { bound, prop, state } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminComponent } from '@/components/view/admin-component.client';
import { CompactPageHeader } from '@/components/ui/view/compact-page-header.client';
import { RecordCard } from '@/components/ui/view/record-card.client';
import { AdminFactGrid } from '@/components/ui/view/admin-fact-grid.client';
import { Alert } from '@/components/ui/view/alert.client';
import { Button } from '@/components/ui/view/button.client';
import { Tabs } from '@/components/ui/view/tabs.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { NotificationType } from '@/components/enums/notification-type.enum';
import { AdminLink } from '@/components/view/admin-link.client';
import { AdminApi } from '@/lib/api';
import { AdminClass } from '@/lib/admin-class';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { EmailSenderText } from '@/app/emails/email-sender-text';
import { EmailColumns } from '@/app/emails/email-columns';
import { EmailCatalogText } from '@/app/emails/email-catalog-text';

/**
 * One kind of email: who sends it, when it goes out, and the email itself drawn with the example data
 * its sender declared — at a computer's width or a phone's — plus "send a test to me".
 */
export class EmailTemplatePage extends AdminComponent {
  @prop declare params: Promise<{ template: string }>;

  @state private id = '';
  @state private entry: any = null;
  @state private preview: any = null;
  @state private error = '';
  @state private phone = false;
  @state private sending = false;

  async componentDidMount(): Promise<void> {
    this.id = decodeURIComponent((await this.params).template);
    try {
      const list = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.EMAILS.CATALOG);
      this.entry = (Array.isArray(list?.templates) ? list.templates : []).find((row: any) => row.id === this.id) ?? null;
      if (!this.entry) {
        this.error = AdminI18n.t('emails.catalog.notFound');
        return;
      }
      const response = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.EMAILS.CATALOG_PREVIEW(this.id));
      this.preview = response?.preview ?? null;
    } catch (error: any) {
      this.error = error?.message || AdminI18n.t('emails.catalog.previewFailed');
    }
  }

  @bound private onWidth(value: string): void {
    this.phone = value === 'phone';
  }

  @bound private async sendTest(): Promise<void> {
    const notify = this.runtime.notify.addNotification;
    this.sending = true;
    try {
      const result = await AdminApi.post(AdminConstants.ENDPOINTS.SYSTEM.EMAILS.CATALOG_TEST(this.id), {});
      notify({ title: AdminI18n.t('emails.catalog.testSentTitle'), message: AdminI18n.t('emails.catalog.testSent', { address: result?.to || '' }), type: NotificationType.SUCCESS });
    } catch (error: any) {
      notify({ title: AdminI18n.t('emails.resend.failedTitle'), message: error?.message || AdminI18n.t('emails.catalog.testFailed'), type: NotificationType.ERROR });
    } finally {
      this.sending = false;
    }
  }

  private get facts(): Array<{ key: string; label: string; value: ReactNode }> {
    const entry = this.entry;
    return [
      { key: 'when', label: AdminI18n.t('emails.catalog.columns.when'), value: EmailCatalogText.trigger(entry) },
      { key: 'sender', label: AdminI18n.t('emails.columns.sender'), value: EmailSenderText.of(entry.sender) },
      { key: 'category', label: AdminI18n.t('emails.fields.category'), value: entry.category || AdminI18n.t('emails.transactional') },
      { key: 'sent', label: AdminI18n.t('emails.catalog.columns.sent', { days: entry.windowDays }), value: String(entry.sentLastWindow ?? 0) },
      { key: 'last', label: AdminI18n.t('emails.catalog.columns.lastSent'), value: entry.lastSentAt ? EmailColumns.time(entry.lastSentAt) : AdminI18n.t('emails.catalog.neverSent') },
      { key: 'id', label: AdminI18n.t('emails.columns.template'), value: entry.id },
    ];
  }

  private renderPreview(): ReactNode {
    const preview = this.preview;
    if (!preview) return null;
    const frameClass = `fc-email-preview${this.phone ? ' fc-email-preview--phone' : ''}`;
    return (
      <div className="fc-stack">
        <Tabs label={AdminI18n.t('emails.catalog.width')} value={this.phone ? 'phone' : 'desktop'} onChange={this.onWidth} variant="second"
          tabs={[{ id: 'desktop', label: AdminI18n.t('emails.catalog.desktop') }, { id: 'phone', label: AdminI18n.t('emails.catalog.phone') }]} />
        <AdminFactGrid facts={[{ key: 'subject', label: AdminI18n.t('emails.columns.subject'), value: preview.subject }]} lockLabel={AdminI18n.t('emails.catalog.exampleData')} />
        {preview.html
          ? <iframe title={preview.subject} sandbox="" srcDoc={preview.html} className={frameClass} />
          : <pre className="fc-email-preview fc-email-preview--text">{preview.text}</pre>}
      </div>
    );
  }

  render(): ReactNode {
    const entry = this.entry;
    return (
      <div className={`w-full ${AdminClass.of('settings-page')}`}>
        <CompactPageHeader
          theme={this.theme}
          backHref={AdminConstants.ROUTES.EMAILS_CATALOG}
          icon={<FrameworkIcons.Mail size={18} strokeWidth={2.5} />}
          title={entry ? EmailCatalogText.label(entry) : AdminI18n.t('emails.catalog.title')}
          subtitle={entry ? EmailCatalogText.trigger(entry) : undefined}
        />
        <div className="w-full py-6 fc-page-stack">
          {this.error ? <Alert tone="danger">{this.error}</Alert> : null}
          {entry ? (
            <>
              <RecordCard
                title={AdminI18n.t('emails.catalog.aboutHeading')}
                aside={(
                  <div className="fc-chip-row">
                    <Button variant={ButtonVariant.SECONDARY} as={AdminLink} href={`${AdminConstants.ROUTES.EMAILS}?template=${encodeURIComponent(entry.id)}`}>{AdminI18n.t('emails.catalog.seeSent')}</Button>
                    <Button variant={ButtonVariant.PRIMARY} isLoading={this.sending} onClick={this.sendTest}>{AdminI18n.t('emails.catalog.sendTest')}</Button>
                  </div>
                )}
              >
                <div className="fc-stack">
                  <AdminFactGrid facts={this.facts} />
                  {entry.sensitive ? <Alert tone="info">{AdminI18n.t('emails.catalog.sensitive')}</Alert> : null}
                </div>
              </RecordCard>
              <RecordCard title={AdminI18n.t('emails.catalog.previewHeading')}>{this.renderPreview()}</RecordCard>
            </>
          ) : null}
        </div>
      </div>
    );
  }
}

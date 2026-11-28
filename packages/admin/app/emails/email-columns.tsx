import type { ReactNode } from 'react';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { EmailStatusBadge } from '@/app/emails/email-status-badge';
import { EmailSenderText } from '@/app/emails/email-sender-text';
import { EmailTemplateNames } from '@/app/emails/email-template-names';

/** The email log as table columns: what happened, when, to whom, what it was and who sent it. */
export class EmailColumns {
  static all(names: Map<string, string> = new Map()): Array<{ header: string; id: string; className?: string; accessor: (row: any) => ReactNode }> {
    return [
      { header: AdminI18n.t('emails.columns.status'), id: 'status', accessor: (row) => <EmailStatusBadge status={String(row.status)} /> },
      { header: AdminI18n.t('emails.columns.sentAt'), id: 'sentAt', accessor: (row) => EmailColumns.time(row.createdAt) },
      { header: AdminI18n.t('emails.columns.to'), id: 'to', accessor: (row) => <span className="fc-dt-strong">{row.to}</span> },
      { header: AdminI18n.t('emails.columns.subject'), id: 'subject', className: 'fc-dt-fill fc-dt-wrap', accessor: (row) => row.subject },
      { header: AdminI18n.t('emails.columns.sender'), id: 'sender', accessor: (row) => EmailSenderText.of(row.sender) },
      { header: AdminI18n.t('emails.columns.template'), id: 'template', accessor: (row) => (row.template ? EmailTemplateNames.of(names, row.template) : null) || <span className="fc-dt-quiet">{AdminI18n.t('emails.noTemplate')}</span> },
    ];
  }

  static time(value: unknown): string {
    return value ? new Date(String(value)).toLocaleString(AdminI18n.locale, { dateStyle: 'medium', timeStyle: 'short' }) : '';
  }
}

import { AdminI18n } from '@/lib/i18n/admin-i18n';

/** Who sent an email: the extension's slug, or the platform itself when none is recorded. */
export class EmailSenderText {
  static of(sender: unknown): string {
    return String(sender ?? '').trim() || AdminI18n.t('emails.platform');
  }
}

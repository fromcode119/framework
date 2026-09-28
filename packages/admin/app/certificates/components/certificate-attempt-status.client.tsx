import type { ReactNode } from 'react';
import { prop } from '@fromcode119/react-class-components';
import { ThemeMode } from '@fromcode119/core/client';
import { AdminComponent } from '@/components/view/admin-component.client';
import { CertificateHost } from '@/lib/certificates/certificate-host';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * What the platform last did for a host, and what it will do next.
 *
 * Without it a failed row shows an error with no date and no future: an operator who has just fixed
 * the cause cannot tell whether the error is from before or after the fix, or whether anything will
 * ever try again. Both are stated — the error with the time it happened, and the next attempt with
 * the time it will happen, or that it goes on the next check.
 */
export class CertificateAttemptStatus extends AdminComponent {
  declare props: Pick<CertificateAttemptStatus, 'entry' | 'checkIntervalMinutes'>;

  @prop declare entry: CertificateHost;
  /** How often the platform looks at queued hosts, as the api reports it. 0 when it did not say. */
  @prop declare checkIntervalMinutes: number;

  private static time(date: Date): string {
    return date.toLocaleTimeString(AdminI18n.locale, { hour: '2-digit', minute: '2-digit' });
  }

  private get nextLine(): string {
    const entry = this.entry;
    if (!entry.isAwaitingPlatform) return '';
    if (entry.isIssuing) return AdminI18n.t('certificates.attempt.orderingNow');
    const next = entry.nextAttemptDate;
    if (next) return AdminI18n.t('certificates.attempt.nextAt', { time: CertificateAttemptStatus.time(next) });
    return this.checkIntervalMinutes > 0
      ? AdminI18n.t('certificates.attempt.queuedEvery', { minutes: this.checkIntervalMinutes })
      : AdminI18n.t('certificates.attempt.queued');
  }

  render(): ReactNode {
    const dark = this.theme === ThemeMode.DARK;
    const entry = this.entry;
    const last = entry.lastAttemptDate;
    const next = this.nextLine;
    return (
      <>
        {entry.lastError ? (
          <p className={`mt-0.5 text-[11px] font-mono truncate ${dark ? 'text-red-400' : 'text-red-600'}`}>
            {last ? `${CertificateAttemptStatus.time(last)} — ` : ''}{entry.lastError}
          </p>
        ) : null}
        {next ? (
          <p className={`mt-0.5 text-[11px] ${dark ? 'text-sky-300' : 'text-sky-700'}`}>{next}</p>
        ) : null}
      </>
    );
  }
}

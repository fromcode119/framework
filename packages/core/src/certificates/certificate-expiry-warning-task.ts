import { CertificateRecord } from '@core/certificates/certificate-record';
import { CertificateSource } from '@core/enums/certificate-source.enum';
import { CertificateStoreService } from '@core/certificates/certificate-store-service';
import { Logger } from '@core/logging';
import { NotificationsContextProxy } from '@core/plugin/context/notifications';
import { PluginEmailTemplateFileService } from '@core/plugin/services/plugin-email-template-file-service';

/**
 * Warns somebody before a certificate runs out.
 *
 * THE PLATFORM HAS TO DO THIS ITSELF. Let's Encrypt ended its expiration notification emails on
 * 4 June 2025, so for an automatically issued certificate nobody else is watching — and for an
 * UPLOADED one nobody ever was: no issuer knows where it was installed, and nothing in this platform
 * renews it. A certificate quietly reaching its last day is the worst failure this feature has,
 * because the first symptom is every visitor getting a browser security warning.
 *
 * Recipients are the PLATFORM's admins, not the site's. That is deliberate rather than a shortcut:
 * uploading a certificate is platform-admin-only, so a site's own administrator cannot act on this
 * warning even if they receive it. Telling somebody about an emergency they have no way to fix is
 * noise, and noise is how real alerts get ignored.
 */
export class CertificateExpiryWarningTask {
  static readonly NAME = 'certificate-expiry-warnings';
  /** Daily, mid-morning. Nothing here is urgent to the hour; the thresholds are days. */
  static readonly SCHEDULE = '0 9 * * *';
  private static readonly TEMPLATE_BASE = 'certificate-expiry';

  private readonly logger = new Logger({ namespace: 'certificate-expiry' });

  constructor(private readonly store: CertificateStoreService, private readonly manager: any) {}

  /**
   * One pass over every stored certificate.
   *
   * A row is warned about only when it has crossed a threshold CLOSER than the last one it was
   * warned at, so a daily run sends four emails over a month rather than thirty.
   */
  async run(): Promise<void> {
    let warned = 0;
    for (const record of await this.store.list()) {
      const due = record.dueWarningDays;
      if (due === null) continue;
      // `lastWarnedDays` counts DOWN as expiry approaches, so an equal or smaller value means this
      // threshold — or a closer one — has already been sent.
      if (record.lastWarnedDays !== null && record.lastWarnedDays <= due) continue;

      await this.warn(record);
      await this.store.markWarned(record.host, due);
      warned += 1;
    }
    if (warned) this.logger.info(`Sent ${warned} certificate expiry warning(s).`);
  }

  private async warn(record: CertificateRecord): Promise<void> {
    const daysRemaining = record.daysRemaining ?? 0;
    const message = PluginEmailTemplateFileService.renderEmail(CertificateExpiryWarningTask.TEMPLATE_BASE, {
      host: record.host,
      siteSlug: record.tenantId ?? '',
      issuer: record.issuer,
      notAfter: record.notAfter ? record.notAfter.toISOString().slice(0, 10) : '',
      daysRemaining: Math.max(daysRemaining, 0),
      isSingleDay: Math.max(daysRemaining, 0) === 1,
      isExpired: daysRemaining < 0,
      isUploaded: record.source === CertificateSource.UPLOADED,
    });

    try {
      await NotificationsContextProxy.createNotificationsProxy(this.manager, 'system').notifyAdmins(message);
    } catch (error: any) {
      // A failed send must not stop the sweep: the next certificate in the list may be the one
      // expiring today.
      this.logger.warn(`Could not send the expiry warning for ${record.host}: ${error?.message || error}`);
    }
  }
}

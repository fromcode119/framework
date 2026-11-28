import type { IDeliveryReport, IInboxFetchResult } from '@fromcode119/email';
import { SystemConstants } from '@core/constants/system.constants';
import { EmailLogStatus } from '@core/email/enums/email-log-status.enum';
import { EmailSuppressionService } from '@core/email/email-suppression-service';
import { PluginInbox } from '@core/email/plugin-inbox';
import { EmailGateway } from '@core/integrations/providers/email-gateway';
import { Logger } from '@core/logging';

/**
 * Reads the site's bounce mailbox and writes what it says into the email log: an email the server
 * accepted and the recipient's server then refused becomes BOUNCED, one a recipient marked as spam
 * becomes COMPLAINED — each with the remote server's own words. A permanent bounce or a complaint also
 * puts the address on the site's do-not-email list (source `bounce` / `complaint`), so the platform
 * stops mailing an address that does not exist or does not want it.
 *
 * Runs once per site (and once for the platform's own mail). Where it got to is kept per site and
 * shown on the Emails page; a site with no bounce mailbox is skipped and the page says that too.
 */
export class EmailBounceReader {
  static readonly NAME = 'system-email-bounce-reader';
  static readonly SCHEDULE = '*/15 * * * *';
  private static readonly logger = new Logger({ namespace: 'email-bounces' });

  constructor(
    private readonly db: any,
    private readonly resolveEmailConfigs: () => Promise<Array<{ config?: Record<string, any> }>>,
  ) {}

  async run(): Promise<void> {
    const configs = await this.resolveEmailConfigs().catch(() => []);
    const mailbox = configs.map((entry) => EmailGateway.bounceOf(entry?.config ?? {})).find(Boolean);
    if (!mailbox) return;
    const cursor = await this.readCursor();
    try {
      if (!mailbox.port) throw new Error('The bounce mailbox has no IMAP port set (Settings → Integrations → Email).');
      const result: IInboxFetchResult = await PluginInbox.fetch(
        { host: mailbox.host, port: mailbox.port, secure: mailbox.port === 993, user: mailbox.user, password: mailbox.password },
        { sinceUid: cursor.lastUid, limit: 100 },
        // The framework's own read: no plugin capability to check. The host is still refused unless public.
        async () => undefined,
      );
      // A renumbered folder (new UIDVALIDITY) is read again from the start next time.
      const lastUid = result.uidValidity === cursor.uidValidity || !cursor.uidValidity ? result.lastUid : 0;
      let applied = 0;
      for (const message of result.messages) {
        if (message.report) applied += await this.apply(message.report);
      }
      await this.writeCursor({ uidValidity: result.uidValidity, lastUid, readAt: new Date().toISOString(), error: null, applied: (cursor.applied ?? 0) + applied });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      EmailBounceReader.logger.warn(`Reading the bounce mailbox failed: ${message}`);
      await this.writeCursor({ ...cursor, readAt: new Date().toISOString(), error: message });
    }
  }

  /**
   * One report against the log. Returns how many log rows it changed.
   *
   * A report counts only when it names the Message-ID of an email this site sent to that same
   * address, and that email went to that address alone. Anyone can mail the bounce mailbox, and an unmatched "bounce" acted on would let a
   * stranger silence a real customer; a matched one proves the report is about our own email.
   */
  async apply(report: IDeliveryReport): Promise<number> {
    if (!report.originalMessageId) return 0;
    // One Message-ID sent to several people proves nothing about any ONE of them: any co-recipient
    // could forge a report naming another. Only a message that went to a single address is trusted.
    const sent: any[] = await this.db.find(SystemConstants.TABLE.EMAIL_LOG, { where: { message_id: report.originalMessageId }, limit: 2 });
    if (sent.length !== 1) return 0;
    let changed = 0;
    for (const recipient of report.recipients) {
      const complaint = report.complaint === true;
      if (!complaint && recipient.action !== 'failed') continue; // `delayed`, `delivered`: nothing has gone wrong yet.
      const [row] = await this.db.find(SystemConstants.TABLE.EMAIL_LOG, {
        where: { to_address: recipient.address, message_id: report.originalMessageId },
        orderBy: { id: 'desc' },
        limit: 1,
      });
      if (!row) continue;
      await this.db.update(SystemConstants.TABLE.EMAIL_LOG, { id: row.id }, {
        status: (complaint ? EmailLogStatus.COMPLAINED : EmailLogStatus.BOUNCED).value,
        error: [recipient.status, recipient.diagnostic].filter(Boolean).join(' — ') || null,
        updated_at: new Date(),
      });
      changed += 1;
      // Only a PERMANENT failure (5.x.x) or a complaint stops future mail; a temporary one does not.
      if (complaint || recipient.status.startsWith('5')) {
        await EmailSuppressionService.suppress(this.db, recipient.address, EmailSuppressionService.ALL, complaint ? 'complaint' : 'bounce');
      }
    }
    return changed;
  }

  private async readCursor(): Promise<{ uidValidity: string; lastUid: number; applied?: number; readAt?: string; error?: string | null }> {
    const row = await this.db.findOne(SystemConstants.TABLE.META, { key: SystemConstants.META_KEY.EMAIL_BOUNCE_CURSOR }).catch(() => null);
    try {
      const value = JSON.parse(String(row?.value || '{}'));
      return { uidValidity: String(value.uidValidity || ''), lastUid: Number(value.lastUid) || 0, applied: Number(value.applied) || 0, readAt: value.readAt, error: value.error ?? null };
    } catch {
      return { uidValidity: '', lastUid: 0 };
    }
  }

  private async writeCursor(value: Record<string, unknown>): Promise<void> {
    const key = SystemConstants.META_KEY.EMAIL_BOUNCE_CURSOR;
    const existing = await this.db.findOne(SystemConstants.TABLE.META, { key });
    if (existing) await this.db.update(SystemConstants.TABLE.META, { key }, { value: JSON.stringify(value) });
    else await this.db.insert(SystemConstants.TABLE.META, { key, value: JSON.stringify(value) });
  }
}

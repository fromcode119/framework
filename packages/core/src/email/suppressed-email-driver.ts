import type { IEmailDriver, IEmailOptions } from '@fromcode119/email';
import { EmailSuppressionService } from '@core/email/email-suppression-service';
import { Logger } from '@core/logging';
import { EmailLogRecorder } from '@core/email/email-log-recorder';
import { EmailLogStatus } from '@core/email/enums/email-log-status.enum';

/**
 * Wraps the configured email driver so the do-not-email list is enforced where mail LEAVES, rather than
 * in every caller that sends it.
 *
 * Checking in the callers was the alternative, and it fails the same way every time: one caller forgets,
 * and nobody notices because the symptom is an email that WAS sent — visible only to the recipient who
 * asked not to receive it.
 *
 * Recipients are filtered individually, so a message to three people where one has opted out still
 * reaches the other two. When every recipient is suppressed the send is skipped entirely and reported
 * as such, so a caller awaiting the result is not told a message went out that did not.
 */
export class SuppressedEmailDriver implements IEmailDriver {
  private static readonly logger = new Logger({ namespace: 'email-suppression' });

  private readonly log: EmailLogRecorder;

  constructor(
    private readonly inner: IEmailDriver,
    private readonly db: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  ) {
    this.log = new EmailLogRecorder(db);
  }

  async send(options: IEmailOptions): Promise<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
    const category = (options as { category?: string })?.category;
    const requested = Array.isArray(options?.to) ? options.to : [options?.to];
    const addresses = requested.map((entry) => String(entry ?? '').trim()).filter(Boolean);

    const allowed: string[] = [];
    for (const address of addresses) {
      if (await EmailSuppressionService.isSuppressed(this.db, address, category)) {
        SuppressedEmailDriver.logger.info(
          `Suppressed ${category ? `"${category}" ` : ''}email to ${address} — the address is on the do-not-email list.`,
        );
        await this.log.record(options, address, EmailLogStatus.SUPPRESSED);
        continue;
      }
      allowed.push(address);
    }

    if (!allowed.length) {
      return { skipped: true, reason: 'suppressed', suppressed: addresses.length };
    }

    // `sender`, `template` and `sensitive` are the log's, not the transport's.
    const { sender: _sender, template: _template, sensitive: _sensitive, ...outgoing } = options; // eslint-disable-line @typescript-eslint/no-unused-vars
    let result: unknown;
    try {
      result = await this.inner.send({ ...outgoing, to: allowed.length === 1 ? allowed[0] : allowed });
    } catch (error) {
      for (const address of allowed) await this.log.record(options, address, EmailLogStatus.FAILED, { error });
      throw error;
    }
    const rejected = EmailLogRecorder.rejected(result);
    for (const address of allowed) {
      const refused = rejected.has(address.toLowerCase());
      await this.log.record(options, address, refused ? EmailLogStatus.FAILED : EmailLogStatus.SENT, refused
        ? { result, error: 'The mail server rejected this recipient.' }
        : { result });
    }
    return result;
  }

  /**
   * Manage the do-not-email list. Exposed HERE so an extension reaches it through `context.email` — the
   * table is a framework system table, and an extension reading or writing one directly is the
   * isolation boundary this codebase does not cross.
   */
  async suppress(address: string, category?: string, source?: string): Promise<void> {
    await EmailSuppressionService.suppress(this.db, address, category, source);
  }

  async unsuppress(address: string, category?: string): Promise<void> {
    await EmailSuppressionService.unsuppress(this.db, address, category);
  }

  async isSuppressed(address: string, category?: string): Promise<boolean> {
    return EmailSuppressionService.isSuppressed(this.db, address, category);
  }

  /** Wraps a driver, or returns it untouched when there is nothing to enforce against. */
  static wrap(driver: IEmailDriver, db: any): IEmailDriver { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!driver || !db) return driver;
    return new SuppressedEmailDriver(driver, db);
  }
}

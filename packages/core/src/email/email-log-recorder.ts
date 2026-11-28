import type { IEmailOptions } from '@fromcode119/email';
import { SystemConstants } from '@core/constants/system.constants';
import { EmailLogStatus } from '@core/email/enums/email-log-status.enum';
import { Logger } from '@core/logging';
import { SchedulerRunJournal } from '@fromcode119/scheduler';

/**
 * Writes down every email that reaches the send layer: one row per recipient, with who sent it, what
 * it said and what happened to it. Read by the admin's Emails screen.
 *
 * The record never decides the email's fate. A row that cannot be written is logged and the send goes
 * on exactly as before — losing a log line is a smaller failure than losing the email.
 */
export class EmailLogRecorder {
  private static readonly logger = new Logger({ namespace: 'email-log' });
  /** Long enough to read a server's reply or a stack's message, short enough to bound one row. */
  private static readonly ERROR_LIMIT = 2000;

  constructor(private readonly db: any) {} // eslint-disable-line @typescript-eslint/no-explicit-any

  async record(options: IEmailOptions, address: string, status: EmailLogStatus, outcome: { error?: unknown; result?: unknown } = {}): Promise<void> {
    try {
      const result = (outcome.result ?? {}) as { messageId?: unknown; response?: unknown };
      await this.db.insert(SystemConstants.TABLE.EMAIL_LOG, {
        sender: EmailLogRecorder.text(options.sender) || null,
        template_key: EmailLogRecorder.text(options.template) || null,
        category: EmailLogRecorder.text(options.category) || null,
        to_address: address.toLowerCase(),
        subject: EmailLogRecorder.text(options.subject),
        html: typeof options.html === 'string' ? options.html : null,
        text: typeof options.text === 'string' ? options.text : null,
        status: status.value,
        error: outcome.error === undefined ? null : EmailLogRecorder.message(outcome.error).slice(0, EmailLogRecorder.ERROR_LIMIT),
        smtp_response: EmailLogRecorder.text(result.response).slice(0, EmailLogRecorder.ERROR_LIMIT) || null,
        message_id: EmailLogRecorder.text(result.messageId) || null,
        scheduler_run_id: SchedulerRunJournal.currentRunId(),
      });
    } catch (error) {
      EmailLogRecorder.logger.warn(`Could not record the email to ${address}: ${EmailLogRecorder.message(error)}`);
    }
  }

  /**
   * Which recipients the server accepted, from the transport's own answer. A transport that does not
   * say (a mock) is taken as accepting everyone it was given — the send did not throw.
   */
  static rejected(result: unknown): Set<string> {
    const list = (result as { rejected?: unknown })?.rejected;
    const values = Array.isArray(list) ? list : [];
    return new Set(values.map((entry) => EmailLogRecorder.text((entry as { address?: unknown })?.address ?? entry).toLowerCase()).filter(Boolean));
  }

  private static text(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private static message(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}

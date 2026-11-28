import { Enum } from '@fromcode119/react-class-components/lang';

/**
 * What happened to one email for one recipient.
 *
 * There is no "delivered": the platform hands mail to an SMTP server, and SMTP reports only whether
 * that server ACCEPTED it. A later bounce report can still turn an accepted message into `BOUNCED`.
 */
export class EmailLogStatus extends Enum {
  /** The mail server accepted the message for this recipient. */
  static readonly SENT = new EmailLogStatus('sent');
  /** Not sent: the address is on the site's do-not-email list for this stream. */
  static readonly SUPPRESSED = new EmailLogStatus('suppressed');
  /**
   * Sending failed, or the mail server rejected this recipient. A site that may not send mail (not in
   * production, no mail server configured) lands here too, with that refusal as the error.
   */
  static readonly FAILED = new EmailLogStatus('failed');
  /** Accepted, then reported undeliverable by the recipient's server. */
  static readonly BOUNCED = new EmailLogStatus('bounced');
  /** Accepted, then reported by the recipient as spam. */
  static readonly COMPLAINED = new EmailLogStatus('complained');

  private constructor(value: string) {
    super(value);
  }
}

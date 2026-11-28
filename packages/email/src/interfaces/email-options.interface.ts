/** Interface definitions for EmailFactory */

export interface IEmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  /**
   * Which STREAM this message belongs to (`review-invitation`, `newsletter`, …), so a recipient can
   * opt out of one kind of mail without losing the rest. Omitted = transactional: only a blanket
   * "stop emailing me" suppresses it, never a marketing opt-out.
   */
  category?: string;
  /**
   * Extra RFC-5322 headers. Exists for `List-Unsubscribe` above all: inbox clients render their own
   * one-click unsubscribe from it, which is what keeps bulk mail out of spam folders, and it has to be
   * a real header — a link in the body cannot serve that purpose.
   */
  headers?: Record<string, string>;
  /**
   * Who sent it, for the email log: the sending extension's slug, stamped by the platform at
   * `context.email` — never taken from the caller. Absent = the platform itself.
   */
  sender?: string;
  /**
   * The body holds something that works as a credential — a sign-in, reset or confirmation link. The
   * email log then keeps who, when and the subject, never the content.
   */
  sensitive?: boolean;
  /** The declared email template this message was rendered from, for the email log and the catalog. */
  template?: string;
}

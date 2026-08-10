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
}

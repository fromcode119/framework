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
}

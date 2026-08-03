/** Interface definitions for EmailFactory */

export interface IEmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
}

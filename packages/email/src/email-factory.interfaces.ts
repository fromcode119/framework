/** Interface definitions for EmailFactory */

export interface EmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
}

export interface EmailDriver {
  send(options: EmailOptions): Promise<any>;
}

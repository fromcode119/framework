import nodemailer, { type Transporter } from 'nodemailer';
import type { IEmailDriver } from '@email/interfaces/email-driver.interface';
import type { IEmailOptions } from '@email/interfaces/email-options.interface';

export class SMTPDriver implements IEmailDriver {
  private transporter: Transporter;

  /**
   * The provider's configured sender, used when the caller names none. Without it a plugin message
   * carried no From at all, and nodemailer then takes the envelope sender from `Reply-To` — so a
   * form notification replying to the visitor was submitted AS the visitor, and the mail server
   * refused it (553 "Sender address rejected: not owned by user").
   */
  private readonly defaultFrom: string;

  constructor(config: {
    host: string;
    port: number;
    secure?: boolean;
    auth: {
      user: string;
      pass: string;
    };
    from?: string;
  }) {
    const { from, ...transport } = config;
    this.defaultFrom = from || '';
    this.transporter = nodemailer.createTransport(transport);
  }

  async send(options: IEmailOptions): Promise<any> {
    return this.transporter.sendMail({
      from: options.from || this.defaultFrom || undefined,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      // Without this the header was accepted by the caller and silently dropped here — a field nothing
      // reads. `List-Unsubscribe` only works as a real header.
      headers: options.headers,
    });
  }
}

import nodemailer from 'nodemailer';
import type { IEmailDriver } from '@email/interfaces/email-driver.interface';
import type { IEmailOptions } from '@email/interfaces/email-options.interface';

export class SMTPDriver implements IEmailDriver {
  private transporter: nodemailer.Transporter;

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
    this.transporter = nodemailer.createTransport(config);
  }

  async send(options: IEmailOptions): Promise<any> {
    return this.transporter.sendMail({
      from: options.from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
  }
}
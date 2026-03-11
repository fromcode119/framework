import nodemailer from 'nodemailer';
import type { EmailDriver, EmailOptions } from '../email-factory.interfaces';

export class SMTPDriver implements EmailDriver {
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

  async send(options: EmailOptions): Promise<any> {
    return this.transporter.sendMail({
      from: options.from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
  }
}
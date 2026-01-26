import nodemailer from 'nodemailer';

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

export class MockEmailDriver implements EmailDriver {
  async send(options: EmailOptions): Promise<any> {
    console.log('[Email:Mock] Sending email:', options);
    return { messageId: 'mock-id-' + Date.now() };
  }
}

export class EmailManager {
  constructor(private driver: EmailDriver) {}

  async send(options: EmailOptions): Promise<any> {
    return this.driver.send(options);
  }
}

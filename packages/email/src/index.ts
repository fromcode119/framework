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

export class EmailManager {
  constructor(private driver: EmailDriver) {}

  async send(options: EmailOptions): Promise<any> {
    return this.driver.send(options);
  }
}

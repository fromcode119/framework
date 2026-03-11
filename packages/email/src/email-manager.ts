import type { EmailDriver, EmailOptions } from './email-factory.interfaces';

export class EmailManager {
  constructor(private driver: EmailDriver) {}

  async send(options: EmailOptions): Promise<any> {
    return this.driver.send(options);
  }
}

import type { IEmailDriver } from '@email/interfaces/email-driver.interface';
import type { IEmailOptions } from '@email/interfaces/email-options.interface';

export class EmailManager {
  constructor(private driver: IEmailDriver) {}

  async send(options: IEmailOptions): Promise<any> {
    return this.driver.send(options);
  }
}

import type { IEmailDriver } from '@email/interfaces/email-driver.interface';

import type { IEmailDriverCreator } from '@email/interfaces/email-driver-creator.interface';

export class EmailFactory {
  private static drivers: Map<string, IEmailDriverCreator> = new Map();

  static register(name: string, creator: IEmailDriverCreator) {
    this.drivers.set(name, creator);
  }

  static create(name: string, config: any): IEmailDriver {
    if (this.drivers.size === 0) {
      this.registerDefaults();
    }

    const creator = this.drivers.get(name);
    if (!creator) {
      throw new Error(`Email driver "${name}" not found.`);
    }
    return creator(config);
  }

  private static registerDefaults() {
    this.register('smtp', (config) => {
      const { SMTPDriver } = require('@email/drivers/smtp');
      return new SMTPDriver(config);
    });
    this.register('mock', () => {
      const { MockEmailDriver } = require('@email/drivers/mock');
      return new MockEmailDriver();
    });
  }
}

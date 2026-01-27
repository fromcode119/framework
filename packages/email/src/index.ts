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

export type EmailDriverCreator = (config: any) => EmailDriver;

export class EmailFactory {
  private static drivers: Map<string, EmailDriverCreator> = new Map();

  static register(name: string, creator: EmailDriverCreator) {
    this.drivers.set(name, creator);
  }

  static create(name: string, config: any): EmailDriver {
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
      const { SMTPDriver } = require('./drivers/smtp');
      return new SMTPDriver(config);
    });
    this.register('mock', () => {
      const { MockEmailDriver } = require('./drivers/mock');
      return new MockEmailDriver();
    });
  }
}

export class EmailManager {
  constructor(private driver: EmailDriver) {}

  async send(options: EmailOptions): Promise<any> {
    return this.driver.send(options);
  }
}

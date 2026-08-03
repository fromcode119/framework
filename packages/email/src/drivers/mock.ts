import type { IEmailDriver } from '@email/interfaces/email-driver.interface';
import type { IEmailOptions } from '@email/interfaces/email-options.interface';

export class MockEmailDriver implements IEmailDriver {
  async send(options: IEmailOptions): Promise<any> {
    console.log('[Email:Mock] Sending email:', options);
    return { messageId: 'mock-id-' + Date.now() };
  }
}
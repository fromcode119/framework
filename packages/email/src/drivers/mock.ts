import { EmailDriver, EmailOptions } from '../index';

export class MockEmailDriver implements EmailDriver {
  async send(options: EmailOptions): Promise<any> {
    console.log('[Email:Mock] Sending email:', options);
    return { messageId: 'mock-id-' + Date.now() };
  }
}

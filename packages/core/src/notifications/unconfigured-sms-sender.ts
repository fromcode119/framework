import type { ISmsSender } from '@core/notifications/interfaces/sms-sender.interface';

/** The site has chosen no text-message provider: nothing is sent, and that is said, not hidden. */
export class UnconfiguredSmsSender implements ISmsSender {
  readonly configured = false;

  async send(): Promise<{ id: string }> {
    throw new Error('Text messages are not set up on this site (Settings → Integrations → Text messages)');
  }
}

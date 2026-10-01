import { UnconfiguredSmsSender } from '@core/notifications/unconfigured-sms-sender';
import type { ISmsSender } from '@core/notifications/interfaces/sms-sender.interface';
import type { IIntegrationTypeDefinition } from '@core/integrations/interfaces/integration-type-definition.interface';

/**
 * Text messages. The framework names no provider: one arrives with the plugin that implements it
 * (`context.sms.registerProvider`), and until a site picks one it is "Not set up" — nothing is sent,
 * and the console says so rather than pretending.
 */
export class SmsIntegrationDefinition {
  static readonly KEY = 'sms';
  static readonly UNCONFIGURED = 'none';

  static readonly definition: IIntegrationTypeDefinition<ISmsSender> = {
    key: SmsIntegrationDefinition.KEY,
    label: 'Text messages',
    description: 'Provider used to send text messages (SMS) to the people who agreed to receive them.',
    defaultProvider: SmsIntegrationDefinition.UNCONFIGURED,
    providers: [
      {
        key: SmsIntegrationDefinition.UNCONFIGURED,
        label: 'Not set up',
        description: 'No text messages are sent. Install a text-message provider plugin and choose it here.',
        create: () => new UnconfiguredSmsSender(),
      },
    ],
  };
}

import { IntegrationConfigFieldType } from '@core/integrations/enums/integration-config-field-type.enum';
import { EmailManager, EmailFactory } from '@fromcode119/email';
import type { IIntegrationTypeDefinition } from '@core/integrations/interfaces/integration-type-definition.interface';
import { EmailGateway } from '@core/integrations/providers/email-gateway';

export class EmailIntegrationDefinition {
  static readonly definition: IIntegrationTypeDefinition<EmailManager> = {
  key: 'email',
  label: 'Email Delivery',
  description: 'Provider used for outbound system and plugin emails.',
  defaultProvider: 'mock',
  resolveFromEnv: EmailGateway.resolveEmailFromEnv,
  providers: [
    {
      key: 'mock',
      label: 'Mock Driver',
      description: 'Logs outbound emails without sending.',
      create: () => new EmailManager(EmailFactory.create('mock', {}))
    },
    {
      key: 'smtp',
      label: 'SMTP',
      description: 'Uses SMTP host credentials for delivery.',
      fields: [
        { name: 'host', label: 'SMTP Host', type: IntegrationConfigFieldType.TEXT, required: true, placeholder: 'smtp.example.com' },
        { name: 'port', label: 'SMTP Port', type: IntegrationConfigFieldType.NUMBER, required: true, placeholder: '587' },
        { name: 'secure', label: 'Use TLS (secure)', type: IntegrationConfigFieldType.BOOLEAN },
        { name: 'user', label: 'SMTP Username', type: IntegrationConfigFieldType.TEXT },
        { name: 'pass', label: 'SMTP Password', type: IntegrationConfigFieldType.PASSWORD }
      ],
      normalizeConfig: EmailGateway.normalizeSmtpConfig,
      create: (config) =>
        new EmailManager(
          EmailFactory.create('smtp', EmailGateway.normalizeSmtpConfig(config))
        )
    }
  ]
  };
}
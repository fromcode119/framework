import { EmailManager, EmailFactory } from '@fromcode119/email';
import type { IntegrationTypeDefinition } from '../integration-registry.interfaces';
import { EmailGateway } from './email-gateway';

export const EmailIntegrationDefinition: IntegrationTypeDefinition<EmailManager> = {
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
        { name: 'host', label: 'SMTP Host', type: 'text', required: true, placeholder: 'smtp.example.com' },
        { name: 'port', label: 'SMTP Port', type: 'number', required: true, placeholder: '587' },
        { name: 'secure', label: 'Use TLS (secure)', type: 'boolean' },
        { name: 'user', label: 'SMTP Username', type: 'text' },
        { name: 'pass', label: 'SMTP Password', type: 'password' }
      ],
      normalizeConfig: EmailGateway.normalizeSmtpConfig,
      create: (config) =>
        new EmailManager(
          EmailFactory.create('smtp', EmailGateway.normalizeSmtpConfig(config))
        )
    }
  ]
};
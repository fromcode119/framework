import { EmailManager, EmailFactory } from '@fromcode119/email';
import type { IntegrationTypeDefinition } from '../integration-registry.interfaces';
import { Logger } from '../../logging';

const logger = new Logger({ namespace: 'EmailGateway' });

export class EmailGateway {
  static normalizeSmtpConfig(input: Record<string, any>) {
    return {
      host: String(input?.host || ''),
      port: Number(input?.port) || 587,
      secure: Boolean(input?.secure),
      auth: {
        user: String(input?.user || ''),
        pass: String(input?.pass || '')
      }
    };
  }

  static resolveEmailFromEnv() {
    const configuredProvider = String(process.env.EMAIL_PROVIDER || '').trim().toLowerCase();
    const requestedProvider = configuredProvider || (process.env.SMTP_HOST ? 'smtp' : 'mock');

    if (!['smtp', 'mock'].includes(requestedProvider)) {
      logger.warn(
        `Email provider "${requestedProvider}" is not implemented. Falling back to "mock".`
      );
      return { provider: 'mock', config: {} };
    }

    if (requestedProvider === 'smtp' && !process.env.SMTP_HOST) {
      logger.warn('EMAIL_PROVIDER is "smtp" but SMTP_HOST is missing. Falling back to "mock".');
      return { provider: 'mock', config: {} };
    }

    if (requestedProvider === 'smtp') {
      return {
        provider: 'smtp',
        config: {
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT) || 587,
          secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
          user: process.env.SMTP_USER || '',
          pass: process.env.SMTP_PASS || ''
        }
      };
    }

    return { provider: 'mock', config: {} };
  }
}


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
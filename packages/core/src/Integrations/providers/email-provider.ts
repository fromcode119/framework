import { EmailManager, EmailFactory } from '@fromcode/email';
import { IntegrationTypeDefinition } from '../integration-registry';
import { Logger } from '../../logging/logger';

const logger = new Logger({ namespace: 'email-provider' });

/**
 * SMTP Configuration Normalizer
 * Ensures SMTP config has the correct structure and types
 */
export function normalizeSmtpConfig(input: Record<string, any>) {
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

/**
 * Email Provider Environment Resolver
 * Attempts to resolve email configuration from environment variables
 */
export function resolveEmailFromEnv() {
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

/**
 * Email Integration Type Definition
 * Defines available email providers and their configuration
 */
export const EmailIntegrationDefinition: IntegrationTypeDefinition<EmailManager> = {
  key: 'email',
  label: 'Email Delivery',
  description: 'Provider used for outbound system and plugin emails.',
  defaultProvider: 'mock',
  resolveFromEnv: resolveEmailFromEnv,
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
        {
          name: 'host',
          label: 'SMTP Host',
          type: 'text',
          required: true,
          placeholder: 'smtp.example.com'
        },
        {
          name: 'port',
          label: 'SMTP Port',
          type: 'number',
          required: true,
          placeholder: '587'
        },
        {
          name: 'secure',
          label: 'Use TLS (secure)',
          type: 'boolean'
        },
        {
          name: 'user',
          label: 'SMTP Username',
          type: 'text'
        },
        {
          name: 'pass',
          label: 'SMTP Password',
          type: 'password'
        }
      ],
      normalizeConfig: normalizeSmtpConfig,
      create: (config) =>
        new EmailManager(
          EmailFactory.create('smtp', normalizeSmtpConfig(config))
        )
    }
  ]
};

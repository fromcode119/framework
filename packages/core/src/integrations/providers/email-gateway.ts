import { Logger } from '../../logging';

const logger = new Logger({ namespace: 'EmailGateway' });

export class EmailGateway {
  static normalizeSmtpConfig(input: Record<string, any>) {
    const auth = input?.auth && typeof input.auth === 'object' ? input.auth : {};
    const user = String(input?.user ?? auth.user ?? '').trim();
    const pass = String(input?.pass ?? auth.pass ?? '').trim();
    return {
      host: String(input?.host || ''),
      port: Number(input?.port) || 587,
      secure: Boolean(input?.secure),
      ...(user || pass
        ? {
            auth: {
              user,
              pass,
            },
          }
        : {})
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
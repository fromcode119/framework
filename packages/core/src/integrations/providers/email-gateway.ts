import { Logger } from '@core/logging';
import { FrameworkEmailSender } from '@core/email/framework-email-sender';

export class EmailGateway {
  private static readonly logger = new Logger({ namespace: 'EmailGateway' });

  static normalizeSmtpConfig(input: Record<string, any>) {
    const auth = input?.auth && typeof input.auth === 'object' ? input.auth : {};
    const user = String(input?.user ?? auth.user ?? '').trim();
    const pass = String(input?.pass ?? auth.pass ?? '').trim();
    // The From Address / From Name on the same screen. Plugin mail names no sender of its own, so
    // this is what it is sent as; blank stays blank (no invented sender).
    const sender = new FrameworkEmailSender(String(input?.fromAddress || ''), String(input?.fromName || ''));
    // Runs twice: the registry normalizes, then the provider's `create` normalizes that result again.
    // The second pass has only `from`, so without this it dropped the sender the first pass set.
    const from = sender.isConfigured ? sender.identity : String(input?.from || '').trim();
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
        : {}),
      ...(from ? { from } : {}),
    };
  }

  static resolveEmailFromEnv() {
    const configuredProvider = String(process.env.EMAIL_PROVIDER || '').trim().toLowerCase();
    const requestedProvider = configuredProvider || (process.env.SMTP_HOST ? 'smtp' : 'mock');

    if (!['smtp', 'mock'].includes(requestedProvider)) {
      EmailGateway.logger.warn(
        `Email provider "${requestedProvider}" is not implemented. Falling back to "mock".`
      );
      return { provider: 'mock', config: {} };
    }

    if (requestedProvider === 'smtp' && !process.env.SMTP_HOST) {
      EmailGateway.logger.warn('EMAIL_PROVIDER is "smtp" but SMTP_HOST is missing. Falling back to "mock".');
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
          pass: process.env.SMTP_PASS || '',
          fromAddress: process.env.EMAIL_FROM || process.env.SMTP_FROM || '',
          fromName: process.env.EMAIL_FROM_NAME || '',
        }
      };
    }

    return { provider: 'mock', config: {} };
  }
}
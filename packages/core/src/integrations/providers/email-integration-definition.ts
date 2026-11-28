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
        { name: 'pass', label: 'SMTP Password', type: IntegrationConfigFieldType.PASSWORD },
        // The sender. Framework email (auth, 2FA, telemetry) used to invent `no-reply@<site domain>`
        // in code — an address no control produced, that the operator could not change, and that
        // silently claimed the site's domain as a mail sender. It is configuration now; blank means
        // the platform will not send rather than guess. See FrameworkEmailSenderService.
        {
          name: 'fromAddress',
          label: 'From Address',
          type: IntegrationConfigFieldType.TEXT,
          placeholder: 'orders@example.com',
        },
        {
          name: 'fromName',
          label: 'From Name',
          type: IntegrationConfigFieldType.TEXT,
          placeholder: 'Shown beside the address; defaults to the platform name',
        },
        // Where bounce and spam reports to this site's mail arrive (its Return-Path mailbox), read every
        // 15 minutes to mark emails in the email log as bounced. Blank host: not read, and the Emails page says so.
        { name: 'bounceHost', label: 'Bounce mailbox: IMAP host', type: IntegrationConfigFieldType.TEXT, placeholder: 'imap.example.com' },
        { name: 'bouncePort', label: 'Bounce mailbox: IMAP port', type: IntegrationConfigFieldType.NUMBER, placeholder: '993' },
        { name: 'bounceUser', label: 'Bounce mailbox: username', type: IntegrationConfigFieldType.TEXT },
        { name: 'bouncePass', label: 'Bounce mailbox: password', type: IntegrationConfigFieldType.PASSWORD },
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
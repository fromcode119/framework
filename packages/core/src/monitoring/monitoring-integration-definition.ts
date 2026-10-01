import { IntegrationConfigFieldType } from '@core/integrations/enums/integration-config-field-type.enum';
import type { IIntegrationTypeDefinition } from '@core/integrations/interfaces/integration-type-definition.interface';

/**
 * The `monitoring` integration descriptor — Settings → Integrations → Monitoring. Several providers may be
 * active at once: the built-in email provider delivers the platform's own incidents, and each external
 * uptime service watches every site from outside. Plugins may register further providers into this type.
 *
 * `create` returns the provider key and its normalised settings, like `sso`; the platform monitor turns
 * that into a working provider (see `MonitoringProviderFactory`), because delivering an incident needs the
 * platform itself, which a definition does not hold.
 */
export class MonitoringIntegrationDefinition {
  private static readonly namePrefixField = {
    name: 'namePrefix',
    label: 'Monitor name prefix',
    type: IntegrationConfigFieldType.TEXT,
    required: true,
    defaultValue: 'Platform: ',
    description: 'Monitors whose name starts with this are the platform\'s: they are added and removed to match the sites. Every other monitor in the account is left alone.',
  };

  private static normalize(config: Record<string, unknown>): Record<string, string> {
    return Object.fromEntries(Object.entries(config ?? {}).map(([key, value]) => [key, String(value ?? '').trim()]));
  }

  private static provider(key: string, label: string, description: string, fields: unknown[]) {
    return {
      key,
      label,
      description,
      fields,
      normalizeConfig: MonitoringIntegrationDefinition.normalize,
      create: (config: Record<string, unknown>) => ({ provider: key, ...MonitoringIntegrationDefinition.normalize(config) }),
    };
  }

  static readonly definition: IIntegrationTypeDefinition<Record<string, string>> = {
    key: 'monitoring',
    label: 'Monitoring',
    description: 'Who is told when a site, a plugin or the server has a problem, and who watches the sites from outside.',
    defaultProvider: 'email',
    allowMultipleActiveProviders: true,
    // One monitor watches every site; a site-level entry would be one nothing reads.
    platformOnly: true,
    providers: [
      MonitoringIntegrationDefinition.provider('email', 'Email', 'Incidents to the platform admins and the notification address in Settings → General.', []),
      MonitoringIntegrationDefinition.provider('uptimerobot', 'UptimeRobot', 'Watches every site from outside and alerts through your UptimeRobot alert contacts, even when the whole server is down.', [
        { name: 'apiKey', label: 'Main API key', type: IntegrationConfigFieldType.PASSWORD, required: true, description: 'UptimeRobot → Integrations & API → Main API key.' },
        // Sent with every monitor it creates, so how often each address is checked is the operator's choice.
        { name: 'interval', label: 'Check every (seconds)', type: IntegrationConfigFieldType.NUMBER, required: true, defaultValue: '300', description: 'How often UptimeRobot checks each address. The free plan allows 300 or more; shorter needs a paid plan.' },
        MonitoringIntegrationDefinition.namePrefixField,
      ]),
      MonitoringIntegrationDefinition.provider('betterstack', 'Better Stack', 'Watches every site from outside and alerts through your Better Stack on-call settings, even when the whole server is down.', [
        { name: 'apiToken', label: 'Uptime API token', type: IntegrationConfigFieldType.PASSWORD, required: true, description: 'Better Stack → Uptime → API tokens.' },
        MonitoringIntegrationDefinition.namePrefixField,
      ]),
    ] as any,
  };
}

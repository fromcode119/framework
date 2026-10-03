import { PluginConsentRisk } from '@core/plugin/consent/enums/plugin-consent-risk.enum';

/**
 * The risk the consent dialog shows for each capability. Anything not listed — a new capability, a
 * typo, a wildcard — is HIGH: an entry nobody has assessed is not assumed harmless.
 */
export class PluginCapabilityRisk {
  private static readonly LOW = new Set(['cache', 'i18n', 'jobs', 'scheduler']);

  private static readonly MEDIUM = new Set([
    'admin', 'api', 'api:routes', 'content', 'database', 'database:read', 'database:write', 'email', 'filesystem:read',
    'frontend', 'hooks', 'integrations', 'network', 'plugins:interact', 'settings', 'storage',
  ]);

  static of(capability: string): PluginConsentRisk {
    const entry = String(capability ?? '').trim().toLowerCase();
    if (PluginCapabilityRisk.LOW.has(entry)) return PluginConsentRisk.LOW;
    if (PluginCapabilityRisk.MEDIUM.has(entry) || entry.startsWith('integration:')) return PluginConsentRisk.MEDIUM;
    return PluginConsentRisk.HIGH;
  }
}

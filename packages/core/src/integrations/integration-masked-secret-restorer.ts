import { IntegrationConfigSanitizer } from '@core/integrations/integration-config-sanitizer';
import { SecretService } from '@core/security/secret-service';
import type { IntegrationStoredProviderService } from '@core/integrations/integration-stored-provider-service';
import type { IIntegrationProviderDefinition } from '@core/integrations/interfaces/integration-provider-definition.interface';

/**
 * Puts a saved provider's real secret back where a config carries the placeholder for it.
 *
 * A plugin never reads a secret in the clear from the settings it is shown: every secret in an integration's
 * saved list is masked first. A plugin that builds a client from one of those saved entries therefore holds a
 * config whose password IS the placeholder, and passing it on sent the placeholder to the carrier as the
 * password ("invalid username and/or password" with a stored password that was fine). The admin's form has the
 * same problem and the same answer on the write path: a masked value means "keep what is stored". This is that
 * rule for building a client.
 *
 * Only the entry the caller names (or the one entry of that provider when none is named) is read, and only for
 * the plugin that registered the provider: credentials go to whoever held the provider when they were saved.
 */
export class IntegrationMaskedSecretRestorer {
  static async restore(
    stored: IntegrationStoredProviderService,
    typeKey: string,
    providerKey: string,
    provider: IIntegrationProviderDefinition<any>,
    config: Record<string, any>,
    providerId?: string,
  ): Promise<Record<string, any>> {
    const masked = IntegrationConfigSanitizer.secretFieldNames(provider).filter((field) => SecretService.isSavedSecretMask(config?.[field]));
    if (!masked.length) return config;

    const wanted = String(providerId || '').trim().toLowerCase();
    const entries = (await stored.readStoredProvidersInternal(typeKey)) || [];
    const candidates = entries.filter((entry) => entry.providerKey === providerKey
      && (!wanted || entry.id.toLowerCase() === wanted)
      && (entry.registeredBy === undefined || entry.registeredBy === (provider.registeredBy ?? '')));
    const entry = wanted ? candidates[0] : (candidates.length === 1 ? candidates[0] : undefined);
    if (!entry) return config;

    const restored = { ...config };
    for (const field of masked) restored[field] = entry.config?.[field] ?? '';
    return restored;
  }
}

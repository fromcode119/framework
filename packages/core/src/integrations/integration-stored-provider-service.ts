import { IntegrationConfigSanitizer } from '@core/integrations/integration-config-sanitizer';
import { Logger } from '@core/logging';
import { SystemConstants } from '@core/constants/system.constants';
import { CoreServices } from '@core/services';
import { IntegrationProfileService } from '@core/integrations/integration-profile-service';
import { SecretService } from '@core/security/secret-service';
import type { IIntegrationProviderDefinition } from '@core/integrations/interfaces/integration-provider-definition.interface';
import type { IIntegrationStoredProvider } from '@core/integrations/interfaces/integration-stored-provider.interface';
import type { IIntegrationTypeRuntime } from '@core/integrations/interfaces/integration-type-runtime.interface';

export class IntegrationStoredProviderService {
  constructor(
    private readonly db: any,
    private readonly logger: Logger,
    private readonly types: Map<string, IIntegrationTypeRuntime<any>>,
    private readonly profileService: IntegrationProfileService,
  ) {}

  async updateStoredConfig(
    typeKey: string,
    providerKey: string,
    config: Record<string, any> = {},
    options: {
      makeActive?: boolean;
      enabled?: boolean;
      providerId?: string;
      providerName?: string;
    } = {},
  ) {
    const normalizedType = this.normalize(typeKey);
    const runtime = this.types.get(normalizedType);
    if (!runtime) throw new Error(`Integration type "${normalizedType}" is not registered`);
    const normalizedProvider = this.normalize(providerKey);
    const provider = runtime.providers.get(normalizedProvider);
    if (!provider) throw new Error(`Integration "${normalizedType}" provider "${normalizedProvider}" is not registered`);

    const existingProviders = (await this.readStoredProvidersInternal(normalizedType)) || [];
    const normalizedProviderId = this.profileService.normalize(String(options.providerId || ''));
    const existing = normalizedProviderId ? existingProviders.find((entry) => entry.id === normalizedProviderId) : null;
    const storedConfig = this.buildStoredConfig(normalizedType, provider, config || {}, existing?.config || {});
    const normalizedConfig = provider.normalizeConfig
      ? provider.normalizeConfig(this.resolveRuntimeConfig(provider, storedConfig))
      : this.resolveRuntimeConfig(provider, storedConfig);
    this.profileService.validateProviderConfig(typeKey, provider, normalizedConfig);

    const nowIso = new Date().toISOString();
    const nextEnabled = options.enabled === undefined ? true : !!options.enabled;
    const providerId = existing?.id || normalizedProviderId || `${normalizedProvider}-${Date.now().toString(36)}`;
    const providerName = String(options.providerName || '').trim() || existing?.name || provider.label;

    const nextEntry: IIntegrationStoredProvider = {
      id: providerId,
      name: providerName,
      providerKey: normalizedProvider,
      config: storedConfig,
      enabled: options.makeActive ? true : nextEnabled,
      createdAt: existing?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    const nextProvidersBase = existing
      ? existingProviders.map((entry) => (entry.id === existing.id ? nextEntry : entry))
      : existingProviders.concat(nextEntry);

    let nextProviders = nextProvidersBase;
    if (options.makeActive && !runtime.definition.allowMultipleActiveProviders) {
      const remaining = nextProvidersBase
        .filter((entry) => entry.id !== nextEntry.id)
        .map((entry) => ({ ...entry, enabled: false, updatedAt: nowIso }));
      nextProviders = [nextEntry, ...remaining];
    }

    await this.writeStoredProviders(normalizedType, nextProviders);
  }

  async readStoredConfig(typeKey: string): Promise<{ providerKey: string; config: Record<string, any> } | null> {
    const normalizedType = this.normalize(typeKey);
    const storedProviders = await this.readStoredProvidersInternal(normalizedType);
    if (!storedProviders?.length) {
      return null;
    }

    const selected = storedProviders.find((entry) => entry.enabled !== false) || storedProviders[0];
    if (!selected?.providerKey) {
      return null;
    }

    // An unregistered provider stays fail-closed the way it already was: no entry at all, so the
    // caller falls through to the stored profiles instead of publishing a config nobody can describe.
    const provider = this.types.get(normalizedType)?.providers.get(selected.providerKey);
    if (!provider) {
      return null;
    }

    return {
      providerKey: selected.providerKey,
      config: IntegrationConfigSanitizer.sanitizeForAdmin(provider, selected.config || {}),
    };
  }

  async readStoredProvidersConfig(typeKey: string): Promise<IIntegrationStoredProvider[] | null> {
    const normalizedType = this.normalize(typeKey);
    const providers = await this.readStoredProvidersInternal(normalizedType);
    if (!providers?.length) {
      return providers;
    }

    const runtime = this.types.get(normalizedType);
    if (!runtime) {
      return null;
    }

    // An entry whose provider is not registered (its plugin is disabled or failed to load) is the case
    // where the server knows LEAST about the config — so it is the case that must reveal least.
    return providers.map((entry) => ({
      ...entry,
      config: IntegrationConfigSanitizer.sanitizeForAdmin(
        runtime.providers.get(entry.providerKey),
        entry.config || {},
      ),
    }));
  }

  sanitizeResolvedConfig(typeKey: string, providerKey: string, config: Record<string, any> = {}): Record<string, any> {
    const normalizedType = this.normalize(typeKey);
    return IntegrationConfigSanitizer.sanitizeForAdmin(
      this.types.get(normalizedType)?.providers.get(this.normalize(providerKey)),
      config || {},
    );
  }

  async setProviderEnabled(typeKey: string, providerId: string, enabled: boolean) {
    const normalizedType = this.normalize(typeKey);
    const normalizedProviderId = this.profileService.normalize(providerId);
    if (!normalizedProviderId) throw new Error(`Provider id is required for integration "${normalizedType}".`);
    const providers = (await this.readStoredProvidersInternal(normalizedType)) || [];
    const existing = providers.find((entry) => entry.id === normalizedProviderId);
    if (!existing) throw new Error(`Provider "${normalizedProviderId}" was not found for integration "${normalizedType}".`);
    const nowIso = new Date().toISOString();
    const nextProviders = providers.map((entry) =>
      entry.id === normalizedProviderId ? { ...entry, enabled: !!enabled, updatedAt: nowIso } : entry,
    );
    await this.writeStoredProviders(normalizedType, nextProviders);
  }

  async removeProvider(typeKey: string, providerId: string) {
    const normalizedType = this.normalize(typeKey);
    const normalizedProviderId = this.profileService.normalize(providerId);
    if (!normalizedProviderId) throw new Error(`Provider id is required for integration "${normalizedType}".`);
    const providers = (await this.readStoredProvidersInternal(normalizedType)) || [];
    const nextProviders = providers.filter((entry) => entry.id !== normalizedProviderId);
    if (nextProviders.length === providers.length) throw new Error(`Provider "${normalizedProviderId}" was not found for integration "${normalizedType}".`);
    if (!nextProviders.length) throw new Error(`Integration "${normalizedType}" requires at least one provider.`);
    await this.writeStoredProviders(normalizedType, nextProviders);
  }

  async readStoredProvidersInternal(typeKey: string): Promise<IIntegrationStoredProvider[] | null> {
    const normalizedType = this.profileService.normalize(typeKey);
    const runtime = this.types.get(normalizedType);
    if (!runtime) return null;

    try {
      const providersRow = await this.db.findOne(
        SystemConstants.TABLE.META,
        { key: this.profileService.getProvidersSettingKey(normalizedType) },
      );
      const raw = String(providersRow?.value || '').trim();
      if (!raw) {
        return null;
      }

      const parsed = this.profileService.safeParseJson(raw, []);
      const source = Array.isArray(parsed?.providers) ? parsed.providers : Array.isArray(parsed) ? parsed : [];
      const normalized = source
        .map((entry: any, index: number) => ({
          id: this.profileService.normalize(String(entry?.id || `${entry?.providerKey || entry?.provider || 'provider'}-${index + 1}`)),
          name: String(entry?.name || '').trim() || undefined,
          providerKey: this.profileService.normalize(String(entry?.providerKey || entry?.provider || '')),
          config: entry?.config && typeof entry.config === 'object' ? entry.config : {},
          enabled: entry?.enabled === undefined ? true : !!entry.enabled,
          createdAt: entry?.createdAt || undefined,
          updatedAt: entry?.updatedAt || undefined,
        }))
        .filter((entry: IIntegrationStoredProvider) => !!entry.id && !!entry.providerKey && runtime.providers.has(entry.providerKey));

      return normalized.length ? normalized : null;
    } catch (error: any) {
      this.logger.warn(`Failed to read integration providers for "${normalizedType}": ${error?.message || String(error)}`);
      return null;
    }
  }

  resolveRuntimeConfig(
    provider: IIntegrationProviderDefinition<any>,
    config: Record<string, any>,
  ): Record<string, any> {
    const secretFields = IntegrationConfigSanitizer.secretFieldNames(provider);
    if (!secretFields.length) {
      return config || {};
    }

    const resolvedConfig: Record<string, any> = { ...(config || {}) };
    for (const fieldName of secretFields) {
      // Only ciphertext is decrypted, so anything else keeps its stored value AND its type — widening
      // the secret set can never coerce a boolean/number field into a string.
      if (SecretService.isEncryptedValue(resolvedConfig[fieldName])) {
        resolvedConfig[fieldName] = SecretService.decrypt(resolvedConfig[fieldName]);
      }
    }
    return resolvedConfig;
  }

  private async writeStoredProviders(typeKey: string, providers: IIntegrationStoredProvider[]) {
    const normalizedType = this.profileService.normalize(typeKey);
    const runtime = this.types.get(normalizedType);
    if (!runtime) throw new Error(`Integration type "${normalizedType}" is not registered`);

    const normalizedProviders = (providers || [])
      .map((entry, index) => ({
        id: this.profileService.normalize(String(entry?.id || `${entry?.providerKey || 'provider'}-${index + 1}`)),
        name: String(entry?.name || '').trim() || undefined,
        providerKey: this.profileService.normalize(String(entry?.providerKey || '')),
        config: entry?.config && typeof entry.config === 'object' ? entry.config : {},
        enabled: entry?.enabled === undefined ? true : !!entry.enabled,
        createdAt: entry?.createdAt,
        updatedAt: entry?.updatedAt,
      }))
      .filter((entry) => !!entry.id && !!entry.providerKey && runtime.providers.has(entry.providerKey));

    if (!normalizedProviders.length) throw new Error(`Integration "${normalizedType}" requires at least one valid provider.`);

    await this.profileService.upsertMeta({
      key: this.profileService.getProvidersSettingKey(normalizedType),
      value: JSON.stringify({ providers: normalizedProviders }),
      group: 'integrations',
      description: `Provider configurations for ${normalizedType} integration.`,
    });
  }

  private buildStoredConfig(
    typeKey: string,
    provider: IIntegrationProviderDefinition<any>,
    nextConfig: Record<string, any>,
    existingConfig: Record<string, any>,
  ): Record<string, any> {
    const secretFields = IntegrationConfigSanitizer.secretFieldNames(provider);
    if (!secretFields.length) {
      return nextConfig || {};
    }

    const resolvedExistingConfig = this.resolveRuntimeConfig(provider, existingConfig || {});
    const mergedConfig: Record<string, any> = { ...(nextConfig || {}) };

    for (const fieldName of secretFields) {
      const incomingValue = mergedConfig[fieldName];
      const existingValue = resolvedExistingConfig[fieldName];
      const hasExistingSecret = String(existingValue || '').trim().length > 0;
      const keepExisting = SecretService.isSavedSecretMask(incomingValue)
        || (String(incomingValue || '').trim() === '' && hasExistingSecret);

      if (keepExisting) {
        mergedConfig[fieldName] = existingValue;
      }
    }

    const storedConfig: Record<string, any> = { ...mergedConfig };
    for (const fieldName of secretFields) {
      const secretValue = String(mergedConfig[fieldName] || '').trim();
      storedConfig[fieldName] = secretValue ? SecretService.encrypt(secretValue) : '';
    }

    return storedConfig;
  }

  private normalize(value: string) {
    return CoreServices.getInstance().content.sanitizeKey(value);
  }
}

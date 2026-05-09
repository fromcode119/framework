import { Logger } from '../logging';
import { SystemConstants } from '../constants';
import { CoreServices } from '../services';
import { IntegrationProfileService } from './integration-profile-service';
import { SecretService as IntegrationSecretService } from '../security/secret-service';
import {
  IntegrationProviderDefinition,
  IntegrationStoredProvider,
  IntegrationTypeRuntime,
} from './integration-registry.interfaces';

export class IntegrationStoredProviderService {
  constructor(
    private readonly db: any,
    private readonly logger: Logger,
    private readonly types: Map<string, IntegrationTypeRuntime<any>>,
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

    const nextEntry: IntegrationStoredProvider = {
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
    if (options.makeActive) {
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

    const provider = this.types.get(normalizedType)?.providers.get(selected.providerKey);
    if (!provider) {
      return null;
    }

    return {
      providerKey: selected.providerKey,
      config: this.sanitizeConfigForAdmin(provider, selected.config || {}),
    };
  }

  async readStoredProvidersConfig(typeKey: string): Promise<IntegrationStoredProvider[] | null> {
    const normalizedType = this.normalize(typeKey);
    const providers = await this.readStoredProvidersInternal(normalizedType);
    if (!providers?.length) {
      return providers;
    }

    const runtime = this.types.get(normalizedType);
    if (!runtime) {
      return null;
    }

    return providers.map((entry) => {
      const provider = runtime.providers.get(entry.providerKey);
      if (!provider) {
        return entry;
      }
      return {
        ...entry,
        config: this.sanitizeConfigForAdmin(provider, entry.config || {}),
      };
    });
  }

  sanitizeResolvedConfig(typeKey: string, providerKey: string, config: Record<string, any> = {}): Record<string, any> {
    const normalizedType = this.normalize(typeKey);
    const provider = this.types.get(normalizedType)?.providers.get(this.normalize(providerKey));
    if (!provider) {
      return config || {};
    }
    return this.sanitizeConfigForAdmin(provider, config || {});
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

  async readStoredProvidersInternal(typeKey: string): Promise<IntegrationStoredProvider[] | null> {
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
        .filter((entry: IntegrationStoredProvider) => !!entry.id && !!entry.providerKey && runtime.providers.has(entry.providerKey));

      return normalized.length ? normalized : null;
    } catch (error: any) {
      this.logger.warn(`Failed to read integration providers for "${normalizedType}": ${error?.message || String(error)}`);
      return null;
    }
  }

  resolveRuntimeConfig(
    provider: IntegrationProviderDefinition<any>,
    config: Record<string, any>,
  ): Record<string, any> {
    const passwordFields = this.getPasswordFieldNames(provider);
    if (!passwordFields.length) {
      return config || {};
    }

    const resolvedConfig: Record<string, any> = { ...(config || {}) };
    for (const fieldName of passwordFields) {
      resolvedConfig[fieldName] = IntegrationSecretService.decrypt(resolvedConfig[fieldName]);
    }
    return resolvedConfig;
  }

  private async writeStoredProviders(typeKey: string, providers: IntegrationStoredProvider[]) {
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
    provider: IntegrationProviderDefinition<any>,
    nextConfig: Record<string, any>,
    existingConfig: Record<string, any>,
  ): Record<string, any> {
    const passwordFields = this.getPasswordFieldNames(provider);
    if (!passwordFields.length) {
      return nextConfig || {};
    }

    const resolvedExistingConfig = this.resolveRuntimeConfig(provider, existingConfig || {});
    const mergedConfig: Record<string, any> = { ...(nextConfig || {}) };

    for (const fieldName of passwordFields) {
      const incomingValue = mergedConfig[fieldName];
      const existingValue = resolvedExistingConfig[fieldName];
      const hasExistingSecret = String(existingValue || '').trim().length > 0;
      const keepExisting = IntegrationSecretService.isSavedSecretMask(incomingValue)
        || (String(incomingValue || '').trim() === '' && hasExistingSecret);

      if (keepExisting) {
        mergedConfig[fieldName] = existingValue;
      }
    }

    const storedConfig: Record<string, any> = { ...mergedConfig };
    for (const fieldName of passwordFields) {
      const secretValue = String(mergedConfig[fieldName] || '').trim();
      storedConfig[fieldName] = secretValue ? IntegrationSecretService.encrypt(secretValue) : '';
    }

    return storedConfig;
  }

  private sanitizeConfigForAdmin(
    provider: IntegrationProviderDefinition<any>,
    config: Record<string, any>,
  ): Record<string, any> {
    const passwordFields = this.getPasswordFieldNames(provider);
    if (!passwordFields.length) {
      return config || {};
    }

    const sanitizedConfig: Record<string, any> = { ...(config || {}) };
    for (const fieldName of passwordFields) {
      if (Object.prototype.hasOwnProperty.call(sanitizedConfig, fieldName)) {
        sanitizedConfig[fieldName] = IntegrationSecretService.maskIfPresent(sanitizedConfig[fieldName]);
      }
    }
    return sanitizedConfig;
  }

  private getPasswordFieldNames(provider: IntegrationProviderDefinition<any>): string[] {
    return (provider.fields || [])
      .filter((field) => field.type === 'password')
      .map((field) => String(field.name || '').trim())
      .filter(Boolean);
  }

  private normalize(value: string) {
    return CoreServices.getInstance().content.sanitizeKey(value);
  }
}

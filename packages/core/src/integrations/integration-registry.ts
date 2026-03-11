/**
 * IntegrationRegistry
 *
 * Manages integration type and provider registration, resolution and instantiation.
 * Profile/provider storage management is delegated to IntegrationProfileService.
 */

import { Logger } from '@fromcode119/sdk';
import { SystemConstants } from '@fromcode119/sdk';
import { CoreServices } from '../services';
import { IntegrationProfileService } from './integration-profile-service';
import {
  IntegrationTypeDefinition,
  IntegrationProviderDefinition,
  IntegrationResolved,
  IntegrationTypeSummary,
  IntegrationStoredProfiles,
  IntegrationStoredProvider,
  IntegrationTypeRuntime,
} from './integration-registry.interfaces';

export class IntegrationRegistry {
  private readonly types = new Map<string, IntegrationTypeRuntime<any>>();
  private readonly logger: Logger;
  private readonly profileService: IntegrationProfileService;

  constructor(private readonly db: any, logger?: Logger) {
    this.logger = logger || new Logger({ namespace: 'integration-registry' });
    this.profileService = new IntegrationProfileService(db, this.logger, this.types);
  }

  // ---------------------------------------------------------------------------
  // Type & provider registration
  // ---------------------------------------------------------------------------

  registerType<TInstance = any>(definition: IntegrationTypeDefinition<TInstance>) {
    const key = this.normalize(definition.key);
    if (!key) throw new Error('Integration type key is required');
    if (!definition.defaultProvider) {
      throw new Error(`Integration type "${key}" must declare a defaultProvider`);
    }

    const runtime: IntegrationTypeRuntime<TInstance> = {
      definition: { ...definition, key },
      providers: new Map(),
    };

    this.types.set(key, runtime as IntegrationTypeRuntime<any>);
    for (const provider of definition.providers || []) {
      this.registerProvider(key, provider);
    }
  }

  unregisterType(typeKey: string): boolean {
    const key = this.normalize(typeKey);
    const existed = this.types.has(key);
    if (existed) {
      this.types.delete(key);
      this.logger.info(`Unregistered integration type: ${key}`);
    }
    return existed;
  }

  unregisterProvider(typeKey: string, providerKey: string): boolean {
    const normalizedType = this.normalize(typeKey);
    const runtime = this.types.get(normalizedType);
    if (!runtime) return false;
    const normalizedProvider = this.normalize(providerKey);
    const existed = runtime.providers.has(normalizedProvider);
    if (existed) {
      runtime.providers.delete(normalizedProvider);
      this.logger.info(`Unregistered provider "${normalizedProvider}" from integration type "${normalizedType}"`);
    }
    return existed;
  }

  registerProvider<TInstance = any>(typeKey: string, provider: IntegrationProviderDefinition<TInstance>) {
    const normalizedType = this.normalize(typeKey);
    const runtime = this.types.get(normalizedType);
    if (!runtime) {
      throw new Error(`Integration type "${normalizedType}" is not registered`);
    }
    const key = this.normalize(provider.key);
    if (!key) throw new Error(`Integration provider key is required for type "${normalizedType}"`);
    runtime.providers.set(key, { ...provider, key });
  }

  // ---------------------------------------------------------------------------
  // Type listing
  // ---------------------------------------------------------------------------

  listTypes(): IntegrationTypeSummary[] {
    return Array.from(this.types.values()).map((runtime) => ({
      key: runtime.definition.key,
      label: runtime.definition.label,
      description: runtime.definition.description,
      defaultProvider: this.normalize(runtime.definition.defaultProvider),
      providers: Array.from(runtime.providers.values()).map((provider) => ({
        key: provider.key,
        label: provider.label,
        description: provider.description,
        fields: provider.fields || [],
      })),
    }));
  }

  getTypeSummary(typeKey: string): IntegrationTypeSummary | null {
    const normalizedType = this.normalize(typeKey);
    const runtime = this.types.get(normalizedType);
    if (!runtime) return null;
    return {
      key: runtime.definition.key,
      label: runtime.definition.label,
      description: runtime.definition.description,
      defaultProvider: this.normalize(runtime.definition.defaultProvider),
      providers: Array.from(runtime.providers.values()).map((provider) => ({
        key: provider.key,
        label: provider.label,
        description: provider.description,
        fields: provider.fields || [],
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // Resolution
  // ---------------------------------------------------------------------------

  async resolve<TInstance = any>(
    typeKey: string,
    options: { preferStored?: boolean } = {},
  ): Promise<IntegrationResolved<TInstance>> {
    const resolvedMany = await this.resolveMany<TInstance>(typeKey, options);
    if (!resolvedMany.length) {
      throw new Error(`Integration "${this.normalize(typeKey)}" could not resolve any provider.`);
    }
    return resolvedMany[0];
  }

  async resolveMany<TInstance = any>(
    typeKey: string,
    options: { preferStored?: boolean } = {},
  ): Promise<IntegrationResolved<TInstance>[]> {
    const normalizedType = this.normalize(typeKey);
    const runtime = this.types.get(normalizedType);
    if (!runtime) {
      throw new Error(`Integration type "${normalizedType}" is not registered`);
    }

    const preferStored = options.preferStored !== false;
    const storedProviders = preferStored ? await this.readStoredProvidersConfig(normalizedType) : null;
    const storedProfiles = preferStored ? await this.readStoredProfilesConfig(normalizedType) : null;
    const envCandidate = runtime.definition.resolveFromEnv?.() || null;

    if (storedProviders?.length) {
      const enabledProviders = storedProviders.filter((entry) => entry.enabled !== false);
      const resolvedFromStored: IntegrationResolved<TInstance>[] = [];
      for (const entry of enabledProviders) {
        if (!entry?.providerKey || !runtime.providers.has(entry.providerKey)) continue;
        const provider = runtime.providers.get(entry.providerKey);
        if (!provider) continue;
        const normalizedConfig = provider.normalizeConfig
          ? provider.normalizeConfig(entry.config || {})
          : entry.config || {};
        resolvedFromStored.push({ type: normalizedType, providerKey: entry.providerKey, provider, config: normalizedConfig, source: 'stored' });
      }
      if (resolvedFromStored.length) return resolvedFromStored;
    } else if (storedProfiles?.profiles?.length) {
      const activeProfile =
        storedProfiles.profiles.find((p) => p.id === storedProfiles.activeProfileId) ||
        storedProfiles.profiles[0];
      if (activeProfile?.providerKey && runtime.providers.has(activeProfile.providerKey)) {
        const provider = runtime.providers.get(activeProfile.providerKey);
        if (provider) {
          const normalizedConfig = provider.normalizeConfig
            ? provider.normalizeConfig(activeProfile.config || {})
            : activeProfile.config || {};
          return [{ type: normalizedType, providerKey: activeProfile.providerKey, provider, config: normalizedConfig, source: 'stored' }];
        }
      } else if (activeProfile?.providerKey) {
        this.logger.warn(`Stored provider "${activeProfile.providerKey}" for integration "${normalizedType}" is not registered. Falling back.`);
      }
    }

    if (envCandidate?.provider) {
      const envProvider = this.normalize(envCandidate.provider);
      if (runtime.providers.has(envProvider)) {
        const provider = runtime.providers.get(envProvider);
        if (provider) {
          const normalizedConfig = provider.normalizeConfig
            ? provider.normalizeConfig(envCandidate.config || {})
            : envCandidate.config || {};
          return [{ type: normalizedType, providerKey: envProvider, provider, config: normalizedConfig, source: 'env' }];
        }
      } else {
        this.logger.warn(`Environment provider "${envProvider}" for integration "${normalizedType}" is not registered. Using default provider.`);
      }
    }

    const providerKey = this.normalize(runtime.definition.defaultProvider);
    const provider = runtime.providers.get(providerKey);
    if (!provider) {
      throw new Error(
        `Integration "${normalizedType}" provider "${providerKey}" is not registered. Available: ${Array.from(runtime.providers.keys()).join(', ')}`,
      );
    }
    const normalizedConfig = provider.normalizeConfig ? provider.normalizeConfig({}) : {};
    return [{ type: normalizedType, providerKey, provider, config: normalizedConfig, source: 'default' }];
  }

  // ---------------------------------------------------------------------------
  // Instantiation
  // ---------------------------------------------------------------------------

  async instantiate<TInstance = any>(
    typeKey: string,
    options: { preferStored?: boolean; context?: { projectRoot?: string; logger?: Logger } } = {},
  ): Promise<{ instance: TInstance; resolved: IntegrationResolved<TInstance> }> {
    const resolved = await this.resolve<TInstance>(typeKey, { preferStored: options.preferStored });
    const instance = await resolved.provider.create(resolved.config, options.context);
    return { instance, resolved };
  }

  async instantiateWithConfig<TInstance = any>(
    typeKey: string,
    providerKey: string,
    config: Record<string, any> = {},
    options: { context?: { projectRoot?: string; logger?: Logger } } = {},
  ): Promise<{ instance: TInstance; resolved: IntegrationResolved<TInstance> }> {
    const normalizedType = this.normalize(typeKey);
    const runtime = this.types.get(normalizedType);
    if (!runtime) throw new Error(`Integration type "${normalizedType}" is not registered`);
    const normalizedProvider = this.normalize(providerKey);
    const provider = runtime.providers.get(normalizedProvider);
    if (!provider) {
      throw new Error(`Integration "${normalizedType}" provider "${normalizedProvider}" is not registered`);
    }
    const normalizedConfig = provider.normalizeConfig ? provider.normalizeConfig(config || {}) : config || {};
    this.profileService.validateProviderConfig(normalizedType, provider, normalizedConfig);
    const instance = await provider.create(normalizedConfig, options.context);
    return { instance, resolved: { type: normalizedType, providerKey: normalizedProvider, provider, config: normalizedConfig, source: 'stored' } };
  }

  async instantiateMany<TInstance = any>(
    typeKey: string,
    options: { preferStored?: boolean; context?: { projectRoot?: string; logger?: Logger } } = {},
  ): Promise<Array<{ instance: TInstance; resolved: IntegrationResolved<TInstance> }>> {
    const resolvedMany = await this.resolveMany<TInstance>(typeKey, { preferStored: options.preferStored });
    return Promise.all(
      resolvedMany.map(async (resolved) => {
        const instance = await resolved.provider.create(resolved.config, options.context);
        return { instance, resolved };
      }),
    );
  }

  // ---------------------------------------------------------------------------
  // Provider & stored config management (delegate to profileService)
  // ---------------------------------------------------------------------------

  async updateStoredConfig(
    typeKey: string,
    providerKey: string,
    config: Record<string, any> = {},
    options: {
      profileId?: string;
      profileName?: string;
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

    const normalizedConfig = provider.normalizeConfig ? provider.normalizeConfig(config || {}) : config || {};
    this.profileService.validateProviderConfig(typeKey, provider, normalizedConfig);

    const nowIso = new Date().toISOString();
    const existingProviders = (await this.readStoredProvidersConfig(normalizedType)) || [];
    const normalizedProviderId = this.profileService.normalize(String(options.providerId || ''));
    const existing = normalizedProviderId ? existingProviders.find((e) => e.id === normalizedProviderId) : null;
    const nextEnabled = options.enabled === undefined ? true : !!options.enabled;
    const providerId = existing?.id || normalizedProviderId || `${normalizedProvider}-${Date.now().toString(36)}`;
    const providerName = String(options.providerName || '').trim() || existing?.name || provider.label;

    const nextEntry: IntegrationStoredProvider = {
      id: providerId, name: providerName, providerKey: normalizedProvider,
      config: normalizedConfig, enabled: options.makeActive ? true : nextEnabled,
      createdAt: existing?.createdAt || nowIso, updatedAt: nowIso,
    };

    const nextProvidersBase = existing
      ? existingProviders.map((e) => (e.id === existing.id ? nextEntry : e))
      : existingProviders.concat(nextEntry);

    let nextProviders = nextProvidersBase;
    if (options.makeActive) {
      const enforceSingleActive = normalizedType !== 'email';
      const remaining = nextProvidersBase
        .filter((e) => e.id !== nextEntry.id)
        .map((e) => enforceSingleActive ? { ...e, enabled: false, updatedAt: nowIso } : e);
      nextProviders = [nextEntry, ...remaining];
    }

    await this.writeStoredProviders(normalizedType, nextProviders);
  }

  async setActiveProfile(typeKey: string, profileId: string) {
    return this.profileService.setActiveProfile(typeKey, profileId);
  }

  async renameProfile(typeKey: string, profileId: string, profileName: string) {
    return this.profileService.renameProfile(typeKey, profileId, profileName);
  }

  async deleteProfile(typeKey: string, profileId: string) {
    return this.profileService.deleteProfile(typeKey, profileId);
  }

  async readStoredConfig(typeKey: string): Promise<{ providerKey: string; config: Record<string, any> } | null> {
    const normalizedType = this.normalize(typeKey);
    const storedProviders = await this.readStoredProvidersInternal(normalizedType);
    if (storedProviders?.length) {
      const selected = storedProviders.find((e) => e.enabled !== false) || storedProviders[0];
      if (selected?.providerKey) return { providerKey: selected.providerKey, config: selected.config || {} };
    }
    const storedProfiles = await this.profileService.readStoredProfiles(normalizedType);
    if (storedProfiles?.profiles?.length) {
      const activeProfile =
        storedProfiles.profiles.find((p) => p.id === storedProfiles.activeProfileId) || storedProfiles.profiles[0];
      if (activeProfile?.providerKey) return { providerKey: activeProfile.providerKey, config: activeProfile.config || {} };
    }
    return this.profileService.readStored(normalizedType);
  }

  async readStoredProfilesConfig(typeKey: string): Promise<IntegrationStoredProfiles | null> {
    return this.profileService.readStoredProfiles(this.normalize(typeKey));
  }

  async readStoredProvidersConfig(typeKey: string): Promise<IntegrationStoredProvider[] | null> {
    return this.readStoredProvidersInternal(this.normalize(typeKey));
  }

  async setProviderEnabled(typeKey: string, providerId: string, enabled: boolean) {
    const normalizedType = this.normalize(typeKey);
    const normalizedProviderId = this.profileService.normalize(providerId);
    if (!normalizedProviderId) throw new Error(`Provider id is required for integration "${normalizedType}".`);
    const providers = (await this.readStoredProvidersInternal(normalizedType)) || [];
    const existing = providers.find((e) => e.id === normalizedProviderId);
    if (!existing) throw new Error(`Provider "${normalizedProviderId}" was not found for integration "${normalizedType}".`);
    const nowIso = new Date().toISOString();
    const nextProviders = providers.map((e) =>
      e.id === normalizedProviderId ? { ...e, enabled: !!enabled, updatedAt: nowIso } : e,
    );
    await this.writeStoredProviders(normalizedType, nextProviders);
  }

  async removeProvider(typeKey: string, providerId: string) {
    const normalizedType = this.normalize(typeKey);
    const normalizedProviderId = this.profileService.normalize(providerId);
    if (!normalizedProviderId) throw new Error(`Provider id is required for integration "${normalizedType}".`);
    const providers = (await this.readStoredProvidersInternal(normalizedType)) || [];
    const nextProviders = providers.filter((e) => e.id !== normalizedProviderId);
    if (nextProviders.length === providers.length) throw new Error(`Provider "${normalizedProviderId}" was not found for integration "${normalizedType}".`);
    if (!nextProviders.length) throw new Error(`Integration "${normalizedType}" requires at least one provider.`);
    await this.writeStoredProviders(normalizedType, nextProviders);
  }

  // ---------------------------------------------------------------------------
  // Private provider storage helpers
  // ---------------------------------------------------------------------------

  private async readStoredProvidersInternal(typeKey: string): Promise<IntegrationStoredProvider[] | null> {
    const normalizedType = this.profileService.normalize(typeKey);
    const runtime = this.types.get(normalizedType);
    if (!runtime) return null;

    try {
      const providersRow = await this.db.findOne(
        SystemConstants.TABLE.META,
        { key: this.profileService.getProvidersSettingKey(normalizedType) },
      );
      const raw = String(providersRow?.value || '').trim();
      if (raw) {
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
          .filter((e: IntegrationStoredProvider) => !!e.id && !!e.providerKey && runtime.providers.has(e.providerKey));
        if (normalized.length) return normalized;
      }
    } catch (error: any) {
      this.logger.warn(`Failed to read integration providers for "${normalizedType}": ${error?.message || String(error)}`);
    }

    const legacy = await this.profileService.readStored(normalizedType);
    if (legacy?.providerKey && runtime.providers.has(legacy.providerKey)) {
      return [{ id: `${legacy.providerKey}-1`, providerKey: legacy.providerKey, config: legacy.config || {}, enabled: true }];
    }
    return null;
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
      .filter((e) => !!e.id && !!e.providerKey && runtime.providers.has(e.providerKey));

    if (!normalizedProviders.length) throw new Error(`Integration "${normalizedType}" requires at least one valid provider.`);

    await this.profileService.upsertMeta({
      key: this.profileService.getProvidersSettingKey(normalizedType),
      value: JSON.stringify({ providers: normalizedProviders }),
      group: 'integrations',
      description: `Provider configurations for ${normalizedType} integration.`,
    });

    const primary = normalizedProviders.find((e) => e.enabled !== false) || normalizedProviders[0];
    await this.profileService.writeStored(normalizedType, primary.providerKey, primary.config || {});
  }

  private normalize(value: string) {
    return CoreServices.getInstance().content.sanitizeKey(value);
  }
}

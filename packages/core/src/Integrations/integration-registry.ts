import { Logger } from '@fromcode/sdk';
import { sanitizeKey } from '../utils';
import { SystemTable } from '@fromcode/sdk/internal';

export type IntegrationConfigFieldType = 'text' | 'textarea' | 'number' | 'boolean' | 'select' | 'password';

export interface IntegrationConfigField {
  name: string;
  label: string;
  type: IntegrationConfigFieldType;
  description?: string;
  required?: boolean;
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
}

export interface IntegrationProviderDefinition<TInstance = any> {
  key: string;
  label: string;
  description?: string;
  fields?: IntegrationConfigField[];
  create: (config: Record<string, any>, context?: { projectRoot?: string; logger?: Logger }) => TInstance | Promise<TInstance>;
  normalizeConfig?: (config: Record<string, any>) => Record<string, any>;
}

export interface IntegrationTypeDefinition<TInstance = any> {
  key: string;
  label: string;
  description?: string;
  defaultProvider: string;
  providers?: IntegrationProviderDefinition<TInstance>[];
  resolveFromEnv?: () => { provider?: string; config?: Record<string, any> } | null;
}

export interface IntegrationResolved<TInstance = any> {
  type: string;
  providerKey: string;
  provider: IntegrationProviderDefinition<TInstance>;
  config: Record<string, any>;
  source: 'stored' | 'env' | 'default';
}

export interface IntegrationTypeSummary {
  key: string;
  label: string;
  description?: string;
  defaultProvider: string;
  providers: Array<{
    key: string;
    label: string;
    description?: string;
    fields?: IntegrationConfigField[];
  }>;
}

export interface IntegrationStoredProfile {
  id: string;
  name: string;
  providerKey: string;
  config: Record<string, any>;
  activeProviderKey?: string;
  providers?: IntegrationStoredProvider[];
  createdAt?: string;
  updatedAt?: string;
}

export interface IntegrationStoredProfiles {
  activeProfileId: string;
  profiles: IntegrationStoredProfile[];
}

export interface IntegrationStoredProvider {
  id: string;
  name?: string;
  providerKey: string;
  config: Record<string, any>;
  enabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface IntegrationTypeRuntime<TInstance = any> {
  definition: IntegrationTypeDefinition<TInstance>;
  providers: Map<string, IntegrationProviderDefinition<TInstance>>;
}

export class IntegrationRegistry {
  private readonly types = new Map<string, IntegrationTypeRuntime<any>>();
  private readonly logger: Logger;

  constructor(private readonly db: any, logger?: Logger) {
    this.logger = logger || new Logger({ namespace: 'integration-registry' });
  }

  registerType<TInstance = any>(definition: IntegrationTypeDefinition<TInstance>) {
    const key = this.normalize(definition.key);
    if (!key) throw new Error('Integration type key is required');
    if (!definition.defaultProvider) {
      throw new Error(`Integration type "${key}" must declare a defaultProvider`);
    }

    const runtime: IntegrationTypeRuntime<TInstance> = {
      definition: {
        ...definition,
        key
      },
      providers: new Map()
    };

    this.types.set(key, runtime as IntegrationTypeRuntime<any>);
    for (const provider of definition.providers || []) {
      this.registerProvider(key, provider);
    }
  }

  registerProvider<TInstance = any>(typeKey: string, provider: IntegrationProviderDefinition<TInstance>) {
    const normalizedType = this.normalize(typeKey);
    const runtime = this.types.get(normalizedType);
    if (!runtime) {
      throw new Error(`Integration type "${normalizedType}" is not registered`);
    }

    const key = this.normalize(provider.key);
    if (!key) throw new Error(`Integration provider key is required for type "${normalizedType}"`);

    runtime.providers.set(key, {
      ...provider,
      key
    });
  }

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
        fields: provider.fields || []
      }))
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
        fields: provider.fields || []
      }))
    };
  }

  async resolve<TInstance = any>(
    typeKey: string,
    options: { preferStored?: boolean } = {}
  ): Promise<IntegrationResolved<TInstance>> {
    const resolvedMany = await this.resolveMany<TInstance>(typeKey, options);
    if (!resolvedMany.length) {
      throw new Error(`Integration "${this.normalize(typeKey)}" could not resolve any provider.`);
    }
    return resolvedMany[0];
  }

  async resolveMany<TInstance = any>(
    typeKey: string,
    options: { preferStored?: boolean } = {}
  ): Promise<IntegrationResolved<TInstance>[]> {
    const normalizedType = this.normalize(typeKey);
    const runtime = this.types.get(normalizedType);
    if (!runtime) {
      throw new Error(`Integration type "${normalizedType}" is not registered`);
    }

    const preferStored = options.preferStored !== false;
    const storedProviders = preferStored ? await this.readStoredProviders(normalizedType) : null;
    const storedProfiles = preferStored ? await this.readStoredProfiles(normalizedType) : null;
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
          : (entry.config || {});
        resolvedFromStored.push({
          type: normalizedType,
          providerKey: entry.providerKey,
          provider,
          config: normalizedConfig,
          source: 'stored'
        });
      }

      if (resolvedFromStored.length) {
        return resolvedFromStored;
      }
    } else if (storedProfiles?.profiles?.length) {
      const activeProfile =
        storedProfiles.profiles.find((profile) => profile.id === storedProfiles.activeProfileId) ||
        storedProfiles.profiles[0];

      if (activeProfile?.providerKey && runtime.providers.has(activeProfile.providerKey)) {
        const provider = runtime.providers.get(activeProfile.providerKey);
        if (provider) {
          const normalizedConfig = provider.normalizeConfig
            ? provider.normalizeConfig(activeProfile.config || {})
            : (activeProfile.config || {});

          return [{
            type: normalizedType,
            providerKey: activeProfile.providerKey,
            provider,
            config: normalizedConfig,
            source: 'stored'
          }];
        }
      } else if (activeProfile?.providerKey) {
        this.logger.warn(
          `Stored provider "${activeProfile.providerKey}" for integration "${normalizedType}" is not registered. Falling back.`
        );
      }
    }

    if (envCandidate?.provider) {
      const envProvider = this.normalize(envCandidate.provider);
      if (runtime.providers.has(envProvider)) {
        const provider = runtime.providers.get(envProvider);
        if (provider) {
          const normalizedConfig = provider.normalizeConfig
            ? provider.normalizeConfig(envCandidate.config || {})
            : (envCandidate.config || {});
          return [{
            type: normalizedType,
            providerKey: envProvider,
            provider,
            config: normalizedConfig,
            source: 'env'
          }];
        }
      } else {
        this.logger.warn(
          `Environment provider "${envProvider}" for integration "${normalizedType}" is not registered. Using default provider.`
        );
      }
    }

    const providerKey = this.normalize(runtime.definition.defaultProvider);
    const provider = runtime.providers.get(providerKey);
    if (!provider) {
      throw new Error(
        `Integration "${normalizedType}" provider "${providerKey}" is not registered. Available: ${Array.from(runtime.providers.keys()).join(', ')}`
      );
    }

    const normalizedConfig = provider.normalizeConfig ? provider.normalizeConfig({}) : {};
    return [{
      type: normalizedType,
      providerKey,
      provider,
      config: normalizedConfig,
      source: 'default'
    }];
  }

  async instantiate<TInstance = any>(
    typeKey: string,
    options: { preferStored?: boolean; context?: { projectRoot?: string; logger?: Logger } } = {}
  ): Promise<{ instance: TInstance; resolved: IntegrationResolved<TInstance> }> {
    const resolved = await this.resolve<TInstance>(typeKey, { preferStored: options.preferStored });
    const instance = await resolved.provider.create(resolved.config, options.context);
    return { instance, resolved };
  }

  async instantiateMany<TInstance = any>(
    typeKey: string,
    options: { preferStored?: boolean; context?: { projectRoot?: string; logger?: Logger } } = {}
  ): Promise<Array<{ instance: TInstance; resolved: IntegrationResolved<TInstance> }>> {
    const resolvedMany = await this.resolveMany<TInstance>(typeKey, { preferStored: options.preferStored });
    const instances = await Promise.all(
      resolvedMany.map(async (resolved) => {
        const instance = await resolved.provider.create(resolved.config, options.context);
        return { instance, resolved };
      })
    );
    return instances;
  }

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
    } = {}
  ) {
    const normalizedType = this.normalize(typeKey);
    const runtime = this.types.get(normalizedType);
    if (!runtime) {
      throw new Error(`Integration type "${normalizedType}" is not registered`);
    }

    const normalizedProvider = this.normalize(providerKey);
    const provider = runtime.providers.get(normalizedProvider);
    if (!provider) {
      throw new Error(
        `Integration "${normalizedType}" provider "${normalizedProvider}" is not registered`
      );
    }

    const normalizedConfig = provider.normalizeConfig ? provider.normalizeConfig(config || {}) : (config || {});
    this.validateProviderConfig(typeKey, provider, normalizedConfig);

    const nowIso = new Date().toISOString();
    const existingProviders = (await this.readStoredProviders(normalizedType)) || [];
    const normalizedProviderId = this.normalize(String(options.providerId || ''));
    const existing = normalizedProviderId
      ? existingProviders.find((entry) => entry.id === normalizedProviderId)
      : null;
    const nextEnabled = options.enabled === undefined ? true : !!options.enabled;
    const providerId = existing?.id || normalizedProviderId || `${normalizedProvider}-${Date.now().toString(36)}`;
    const providerName = String(options.providerName || '').trim() || existing?.name || provider.label;

    const nextEntry: IntegrationStoredProvider = {
      id: providerId,
      name: providerName,
      providerKey: normalizedProvider,
      config: normalizedConfig,
      enabled: nextEnabled,
      createdAt: existing?.createdAt || nowIso,
      updatedAt: nowIso
    };

    const nextProviders = existing
      ? existingProviders.map((entry) => (entry.id === existing.id ? nextEntry : entry))
      : existingProviders.concat(nextEntry);

    await this.writeStoredProviders(normalizedType, nextProviders);
  }

  async setActiveProfile(typeKey: string, profileId: string) {
    const normalizedType = this.normalize(typeKey);
    const normalizedProfileId = this.normalize(profileId);
    if (!normalizedProfileId) {
      throw new Error(`Profile id is required for integration "${normalizedType}".`);
    }

    const storedProfiles = await this.readStoredProfiles(normalizedType);
    if (!storedProfiles?.profiles?.length) {
      throw new Error(`Integration "${normalizedType}" has no stored profiles.`);
    }

    const targetProfile = storedProfiles.profiles.find((profile) => profile.id === normalizedProfileId);
    if (!targetProfile) {
      throw new Error(`Profile "${normalizedProfileId}" was not found for integration "${normalizedType}".`);
    }

    await this.writeStoredProfiles(normalizedType, {
      activeProfileId: normalizedProfileId,
      profiles: storedProfiles.profiles
    });
  }

  async renameProfile(typeKey: string, profileId: string, profileName: string) {
    const normalizedType = this.normalize(typeKey);
    const normalizedProfileId = this.normalize(profileId);
    const normalizedProfileName = String(profileName || '').trim();

    if (!normalizedProfileId) {
      throw new Error(`Profile id is required for integration "${normalizedType}".`);
    }
    if (!normalizedProfileName) {
      throw new Error(`Profile name is required for integration "${normalizedType}".`);
    }

    const storedProfiles = await this.readStoredProfiles(normalizedType);
    if (!storedProfiles?.profiles?.length) {
      throw new Error(`Integration "${normalizedType}" has no stored profiles.`);
    }

    const nowIso = new Date().toISOString();
    const updatedProfiles = storedProfiles.profiles.map((profile) => {
      if (profile.id !== normalizedProfileId) return profile;
      return {
        ...profile,
        name: normalizedProfileName,
        updatedAt: nowIso
      };
    });

    const exists = updatedProfiles.some((profile) => profile.id === normalizedProfileId);
    if (!exists) {
      throw new Error(`Profile "${normalizedProfileId}" was not found for integration "${normalizedType}".`);
    }

    await this.writeStoredProfiles(normalizedType, {
      activeProfileId: storedProfiles.activeProfileId || normalizedProfileId,
      profiles: updatedProfiles
    });
  }

  async deleteProfile(typeKey: string, profileId: string) {
    const normalizedType = this.normalize(typeKey);
    const normalizedProfileId = this.normalize(profileId);
    if (!normalizedProfileId) {
      throw new Error(`Profile id is required for integration "${normalizedType}".`);
    }

    const storedProfiles = await this.readStoredProfiles(normalizedType);
    if (!storedProfiles?.profiles?.length) {
      throw new Error(`Integration "${normalizedType}" has no stored profiles.`);
    }

    const remainingProfiles = storedProfiles.profiles.filter((profile) => profile.id !== normalizedProfileId);
    if (remainingProfiles.length === storedProfiles.profiles.length) {
      throw new Error(`Profile "${normalizedProfileId}" was not found for integration "${normalizedType}".`);
    }
    if (!remainingProfiles.length) {
      throw new Error(`Integration "${normalizedType}" must keep at least one profile.`);
    }

    const nextActiveProfileId =
      storedProfiles.activeProfileId === normalizedProfileId
        ? remainingProfiles[0].id
        : storedProfiles.activeProfileId;

    await this.writeStoredProfiles(normalizedType, {
      activeProfileId: nextActiveProfileId,
      profiles: remainingProfiles
    });
  }

  async readStoredConfig(typeKey: string): Promise<{ providerKey: string; config: Record<string, any> } | null> {
    const normalizedType = this.normalize(typeKey);
    const storedProviders = await this.readStoredProviders(normalizedType);
    if (storedProviders?.length) {
      const selected = storedProviders.find((entry) => entry.enabled !== false) || storedProviders[0];
      if (selected?.providerKey) {
        return {
          providerKey: selected.providerKey,
          config: selected.config || {}
        };
      }
    }

    const storedProfiles = await this.readStoredProfiles(normalizedType);
    if (storedProfiles?.profiles?.length) {
      const activeProfile =
        storedProfiles.profiles.find((profile) => profile.id === storedProfiles.activeProfileId) ||
        storedProfiles.profiles[0];
      if (activeProfile?.providerKey) {
        return {
          providerKey: activeProfile.providerKey,
          config: activeProfile.config || {}
        };
      }
    }
    return this.readStored(normalizedType);
  }

  async readStoredProfilesConfig(typeKey: string): Promise<IntegrationStoredProfiles | null> {
    const normalizedType = this.normalize(typeKey);
    return this.readStoredProfiles(normalizedType);
  }

  async readStoredProvidersConfig(typeKey: string): Promise<IntegrationStoredProvider[] | null> {
    const normalizedType = this.normalize(typeKey);
    return this.readStoredProviders(normalizedType);
  }

  async setProviderEnabled(typeKey: string, providerId: string, enabled: boolean) {
    const normalizedType = this.normalize(typeKey);
    const normalizedProviderId = this.normalize(providerId);
    if (!normalizedProviderId) {
      throw new Error(`Provider id is required for integration "${normalizedType}".`);
    }

    const providers = (await this.readStoredProviders(normalizedType)) || [];
    const existing = providers.find((entry) => entry.id === normalizedProviderId);
    if (!existing) {
      throw new Error(`Provider "${normalizedProviderId}" was not found for integration "${normalizedType}".`);
    }

    const nowIso = new Date().toISOString();
    const nextProviders = providers.map((entry) =>
      entry.id === normalizedProviderId
        ? { ...entry, enabled: !!enabled, updatedAt: nowIso }
        : entry
    );

    await this.writeStoredProviders(normalizedType, nextProviders);
  }

  private async readStoredProviders(typeKey: string): Promise<IntegrationStoredProvider[] | null> {
    const normalizedType = this.normalize(typeKey);
    const runtime = this.types.get(normalizedType);
    if (!runtime) return null;

    try {
      const providersRow = await this.db.findOne(SystemTable.META, { key: this.getProvidersSettingKey(normalizedType) });
      const raw = String(providersRow?.value || '').trim();
      if (raw) {
        const parsed = this.safeParseJson(raw, []);
        const source = Array.isArray(parsed?.providers) ? parsed.providers : (Array.isArray(parsed) ? parsed : []);
        const normalized = source
          .map((entry: any, index: number) => ({
            id: this.normalize(String(entry?.id || `${entry?.providerKey || entry?.provider || 'provider'}-${index + 1}`)),
            name: String(entry?.name || '').trim() || undefined,
            providerKey: this.normalize(String(entry?.providerKey || entry?.provider || '')),
            config: entry?.config && typeof entry.config === 'object' ? entry.config : {},
            enabled: entry?.enabled === undefined ? true : !!entry.enabled,
            createdAt: entry?.createdAt || undefined,
            updatedAt: entry?.updatedAt || undefined
          }))
          .filter((entry: IntegrationStoredProvider) => !!entry.id && !!entry.providerKey && runtime.providers.has(entry.providerKey));

        if (normalized.length) return normalized;
      }
    } catch (error: any) {
      this.logger.warn(
        `Failed to read integration providers for "${normalizedType}": ${error?.message || String(error)}`
      );
    }

    const legacy = await this.readStored(normalizedType);
    if (legacy?.providerKey && runtime.providers.has(legacy.providerKey)) {
      return [
        {
          id: `${legacy.providerKey}-1`,
          providerKey: legacy.providerKey,
          config: legacy.config || {},
          enabled: true
        }
      ];
    }

    return null;
  }

  private async writeStoredProviders(typeKey: string, providers: IntegrationStoredProvider[]) {
    const normalizedType = this.normalize(typeKey);
    const runtime = this.types.get(normalizedType);
    if (!runtime) {
      throw new Error(`Integration type "${normalizedType}" is not registered`);
    }

    const normalizedProviders = (providers || [])
      .map((entry, index) => ({
        id: this.normalize(String(entry?.id || `${entry?.providerKey || 'provider'}-${index + 1}`)),
        name: String(entry?.name || '').trim() || undefined,
        providerKey: this.normalize(String(entry?.providerKey || '')),
        config: entry?.config && typeof entry.config === 'object' ? entry.config : {},
        enabled: entry?.enabled === undefined ? true : !!entry.enabled,
        createdAt: entry?.createdAt,
        updatedAt: entry?.updatedAt
      }))
      .filter((entry) => !!entry.id && !!entry.providerKey && runtime.providers.has(entry.providerKey));

    if (!normalizedProviders.length) {
      throw new Error(`Integration "${normalizedType}" requires at least one valid provider.`);
    }

    await this.upsertMeta({
      key: this.getProvidersSettingKey(normalizedType),
      value: JSON.stringify({ providers: normalizedProviders }),
      group: 'integrations',
      description: `Provider configurations for ${normalizedType} integration.`
    });

    const primary = normalizedProviders.find((entry) => entry.enabled !== false) || normalizedProviders[0];
    await this.writeStored(normalizedType, primary.providerKey, primary.config || {});
  }

  async removeProvider(typeKey: string, providerId: string) {
    const normalizedType = this.normalize(typeKey);
    const normalizedProviderId = this.normalize(providerId);
    if (!normalizedProviderId) {
      throw new Error(`Provider id is required for integration "${normalizedType}".`);
    }

    const providers = (await this.readStoredProviders(normalizedType)) || [];
    const nextProviders = providers.filter((entry) => entry.id !== normalizedProviderId);
    if (nextProviders.length === providers.length) {
      throw new Error(`Provider "${normalizedProviderId}" was not found for integration "${normalizedType}".`);
    }
    if (!nextProviders.length) {
      throw new Error(`Integration "${normalizedType}" requires at least one provider.`);
    }

    await this.writeStoredProviders(normalizedType, nextProviders);
  }

  private async readStored(typeKey: string): Promise<{ providerKey: string; config: Record<string, any> } | null> {
    try {
      const providerRow = await this.db.findOne(SystemTable.META, { key: this.getProviderSettingKey(typeKey) });
      const configRow = await this.db.findOne(SystemTable.META, { key: this.getConfigSettingKey(typeKey) });

      const providerKey = this.normalize(String(providerRow?.value || ''));
      const rawConfig = String(configRow?.value || '').trim();
      const config = rawConfig ? this.safeParseJson(rawConfig, {}) : {};

      if (!providerKey) return null;
      return { providerKey, config };
    } catch (error: any) {
      this.logger.warn(
        `Failed to read integration settings for "${typeKey}": ${error?.message || String(error)}`
      );
      return null;
    }
  }

  private async writeStored(typeKey: string, providerKey: string, config: Record<string, any>) {
    const providerMeta = {
      key: this.getProviderSettingKey(typeKey),
      value: providerKey,
      group: 'integrations',
      description: `Active provider for ${typeKey} integration.`
    };

    const configMeta = {
      key: this.getConfigSettingKey(typeKey),
      value: JSON.stringify(config || {}),
      group: 'integrations',
      description: `JSON configuration for ${typeKey} integration provider.`
    };

    await this.upsertMeta(providerMeta);
    await this.upsertMeta(configMeta);
  }

  private async readStoredProfiles(typeKey: string): Promise<IntegrationStoredProfiles | null> {
    const normalizedType = this.normalize(typeKey);
    const runtime = this.types.get(normalizedType);
    if (!runtime) return null;

    try {
      const profilesRow = await this.db.findOne(SystemTable.META, { key: this.getProfilesSettingKey(normalizedType) });
      const rawProfiles = String(profilesRow?.value || '').trim();

      if (rawProfiles) {
        const parsed = this.safeParseJson(rawProfiles, {});
        const incomingProfiles = Array.isArray(parsed?.profiles) ? parsed.profiles : [];
        const activeProfileId = this.normalize(String(parsed?.activeProfileId || '')) || '';
        const profiles: IntegrationStoredProfile[] = incomingProfiles
          .map((profile: any) => ({
            id: this.normalize(String(profile?.id || '')),
            name: String(profile?.name || '').trim() || 'Profile',
            providerKey: this.normalize(String(profile?.providerKey || '')),
            config: profile?.config && typeof profile.config === 'object' ? profile.config : {},
            createdAt: profile?.createdAt || undefined,
            updatedAt: profile?.updatedAt || undefined
          }))
          .filter((profile: IntegrationStoredProfile) => !!profile.id && !!profile.providerKey && runtime.providers.has(profile.providerKey));

        if (profiles.length) {
          return {
            activeProfileId: profiles.some((profile) => profile.id === activeProfileId) ? activeProfileId : profiles[0].id,
            profiles
          };
        }
      }
    } catch (error: any) {
      this.logger.warn(
        `Failed to read integration profiles for "${normalizedType}": ${error?.message || String(error)}`
      );
    }

    const legacy = await this.readStored(normalizedType);
    if (legacy?.providerKey) {
      return {
        activeProfileId: 'default',
        profiles: [
          {
            id: 'default',
            name: 'Default',
            providerKey: legacy.providerKey,
            config: legacy.config || {}
          }
        ]
      };
    }

    return null;
  }

  private async writeStoredProfiles(typeKey: string, payload: IntegrationStoredProfiles) {
    const normalizedType = this.normalize(typeKey);
    const runtime = this.types.get(normalizedType);
    if (!runtime) {
      throw new Error(`Integration type "${normalizedType}" is not registered`);
    }

    const normalizedProfiles = (payload?.profiles || [])
      .map((profile) => ({
        id: this.normalize(String(profile?.id || '')),
        name: String(profile?.name || '').trim() || 'Profile',
        providerKey: this.normalize(String(profile?.providerKey || '')),
        config: profile?.config && typeof profile.config === 'object' ? profile.config : {},
        createdAt: profile?.createdAt,
        updatedAt: profile?.updatedAt
      }))
      .filter((profile) => !!profile.id && !!profile.providerKey && runtime.providers.has(profile.providerKey));

    if (!normalizedProfiles.length) {
      throw new Error(`Integration "${normalizedType}" requires at least one valid profile.`);
    }

    const activeProfileId =
      this.normalize(payload?.activeProfileId || '') ||
      normalizedProfiles[0].id;

    const selectedProfile =
      normalizedProfiles.find((profile) => profile.id === activeProfileId) ||
      normalizedProfiles[0];

    await this.upsertMeta({
      key: this.getProfilesSettingKey(normalizedType),
      value: JSON.stringify({
        activeProfileId: selectedProfile.id,
        profiles: normalizedProfiles
      }),
      group: 'integrations',
      description: `Profile configurations for ${normalizedType} integration providers.`
    });

    await this.writeStored(normalizedType, selectedProfile.providerKey, selectedProfile.config || {});
  }

  private async upsertMeta(entry: { key: string; value: string; group?: string; description?: string }) {
    const existing = await this.db.findOne(SystemTable.META, { key: entry.key });
    if (existing) {
      await this.db.update(
        SystemTable.META,
        { key: entry.key },
        {
          value: entry.value,
          group: entry.group || existing.group || null,
          description: entry.description || existing.description || null,
          updated_at: new Date()
        }
      );
      return;
    }

    await this.db.insert(SystemTable.META, {
      key: entry.key,
      value: entry.value,
      group: entry.group || 'integrations',
      description: entry.description || null
    });
  }

  private getProviderSettingKey(typeKey: string) {
    return `integration_${typeKey}_provider`;
  }

  private getConfigSettingKey(typeKey: string) {
    return `integration_${typeKey}_config`;
  }

  private getProvidersSettingKey(typeKey: string) {
    return `integration_${typeKey}_providers`;
  }

  private getProfilesSettingKey(typeKey: string) {
    return `integration_${typeKey}_profiles`;
  }

  private normalize(value: string) {
    return sanitizeKey(value);
  }

  private safeParseJson(value: string, fallback: any) {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  private validateProviderConfig(
    typeKey: string,
    provider: IntegrationProviderDefinition<any>,
    config: Record<string, any>
  ) {
    const fields = provider.fields || [];
    for (const field of fields) {
      const value = config?.[field.name];
      const isEmpty = value === undefined || value === null || String(value).trim() === '';

      if (field.required && isEmpty) {
        throw new Error(`Integration "${typeKey}" provider "${provider.key}" requires field "${field.name}".`);
      }

      if (field.type === 'number' && !isEmpty && Number.isNaN(Number(value))) {
        throw new Error(`Integration "${typeKey}" provider "${provider.key}" field "${field.name}" must be a number.`);
      }
    }
  }
}

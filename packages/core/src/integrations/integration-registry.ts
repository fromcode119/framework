import { SettingSource } from '@core/settings/enums/setting-source.enum';
/**
 * IntegrationRegistry
 *
 * Manages integration type and provider registration, resolution and instantiation.
 * Profile/provider storage management is delegated to IntegrationProfileService.
 */

import { Logger } from '@core/logging';
import { CoreServices } from '@core/services';
import { IntegrationProfileService } from '@core/integrations/integration-profile-service';
import { IntegrationStoredProviderService } from '@core/integrations/integration-stored-provider-service';
import { IntegrationResolverService } from '@core/integrations/integration-resolver-service';
import type { IIntegrationTypeDefinition } from '@core/integrations/interfaces/integration-type-definition.interface';
import type { IIntegrationProviderDefinition } from '@core/integrations/interfaces/integration-provider-definition.interface';
import type { IIntegrationResolved } from '@core/integrations/interfaces/integration-resolved.interface';
import type { IIntegrationTypeSummary } from '@core/integrations/interfaces/integration-type-summary.interface';
import type { IIntegrationStoredProfiles } from '@core/integrations/interfaces/integration-stored-profiles.interface';
import type { IIntegrationStoredProvider } from '@core/integrations/interfaces/integration-stored-provider.interface';
import type { IIntegrationTypeRuntime } from '@core/integrations/interfaces/integration-type-runtime.interface';

export class IntegrationRegistry {
  private readonly types = new Map<string, IIntegrationTypeRuntime<any>>();
  private readonly logger: Logger;
  private readonly profileService: IntegrationProfileService;
  private readonly storedProviderService: IntegrationStoredProviderService;
  private readonly resolverService: IntegrationResolverService;

  constructor(private readonly db: any, logger?: Logger) {
    this.logger = logger || new Logger({ namespace: 'integration-registry' });
    this.profileService = new IntegrationProfileService(db, this.logger, this.types);
    this.storedProviderService = new IntegrationStoredProviderService(db, this.logger, this.types, this.profileService);
    this.resolverService = new IntegrationResolverService(
      this.types,
      this.storedProviderService,
      this.logger,
      (value: string) => this.normalize(value),
      (typeKey: string) => this.readStoredProfilesConfig(typeKey),
    );
  }

  // ---------------------------------------------------------------------------
  // Type & provider registration
  // ---------------------------------------------------------------------------

  registerType<TInstance = any>(definition: IIntegrationTypeDefinition<TInstance>) {
    const key = this.normalize(definition.key);
    if (!key) throw new Error('Integration type key is required');
    if (!definition.defaultProvider) {
      throw new Error(`Integration type "${key}" must declare a defaultProvider`);
    }

    const runtime: IIntegrationTypeRuntime<TInstance> = {
      definition: { ...definition, key },
      providers: new Map(),
    };

    this.types.set(key, runtime as IIntegrationTypeRuntime<any>);
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

  registerProvider<TInstance = any>(typeKey: string, provider: IIntegrationProviderDefinition<TInstance>) {
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

  listTypes(): IIntegrationTypeSummary[] {
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

  getTypeSummary(typeKey: string): IIntegrationTypeSummary | null {
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
  ): Promise<IIntegrationResolved<TInstance>> {
    const resolvedMany = await this.resolveMany<TInstance>(typeKey, options);
    if (!resolvedMany.length) {
      throw new Error(`Integration "${this.normalize(typeKey)}" could not resolve any provider.`);
    }
    return resolvedMany[0];
  }

  async resolveMany<TInstance = any>(
    typeKey: string,
    options: { preferStored?: boolean } = {},
  ): Promise<IIntegrationResolved<TInstance>[]> {
    return this.resolverService.resolveMany<TInstance>(typeKey, options);
  }

  // ---------------------------------------------------------------------------
  // Instantiation
  // ---------------------------------------------------------------------------

  async instantiate<TInstance = any>(
    typeKey: string,
    options: { preferStored?: boolean; context?: { projectRoot?: string; logger?: Logger } } = {},
  ): Promise<{ instance: TInstance; resolved: IIntegrationResolved<TInstance> }> {
    const resolved = await this.resolve<TInstance>(typeKey, { preferStored: options.preferStored });
    const instance = await resolved.provider.create(resolved.config, options.context);
    return { instance, resolved };
  }

  async instantiateWithConfig<TInstance = any>(
    typeKey: string,
    providerKey: string,
    config: Record<string, any> = {},
    options: { context?: { projectRoot?: string; logger?: Logger } } = {},
  ): Promise<{ instance: TInstance; resolved: IIntegrationResolved<TInstance> }> {
    const normalizedType = this.normalize(typeKey);
    const runtime = this.types.get(normalizedType);
    if (!runtime) throw new Error(`Integration type "${normalizedType}" is not registered`);
    const normalizedProvider = this.normalize(providerKey);
    const provider = runtime.providers.get(normalizedProvider);
    if (!provider) {
      throw new Error(`Integration "${normalizedType}" provider "${normalizedProvider}" is not registered`);
    }
    const resolvedConfig = this.storedProviderService.resolveRuntimeConfig(provider, config || {});
    const normalizedConfig = provider.normalizeConfig ? provider.normalizeConfig(resolvedConfig) : resolvedConfig;
    this.profileService.validateProviderConfig(normalizedType, provider, normalizedConfig);
    const instance = await provider.create(normalizedConfig, options.context);
    return { instance, resolved: { type: normalizedType, providerKey: normalizedProvider, provider, config: normalizedConfig, source: SettingSource.STORED } };
  }

  async instantiateMany<TInstance = any>(
    typeKey: string,
    options: { preferStored?: boolean; context?: { projectRoot?: string; logger?: Logger } } = {},
  ): Promise<Array<{ instance: TInstance; resolved: IIntegrationResolved<TInstance> }>> {
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
    await this.storedProviderService.updateStoredConfig(typeKey, providerKey, config, options);
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
    const storedProviderConfig = await this.storedProviderService.readStoredConfig(typeKey);
    if (storedProviderConfig) {
      return storedProviderConfig;
    }

    const normalizedType = this.normalize(typeKey);
    const storedProfiles = await this.profileService.readStoredProfiles(normalizedType);
    if (storedProfiles?.profiles?.length) {
      const activeProfile =
        storedProfiles.profiles.find((p) => p.id === storedProfiles.activeProfileId) || storedProfiles.profiles[0];
      if (activeProfile?.providerKey) {
        return {
          providerKey: activeProfile.providerKey,
          config: this.storedProviderService.sanitizeResolvedConfig(normalizedType, activeProfile.providerKey, activeProfile.config || {}),
        };
      }
    }
    return null;
  }

  async readStoredProfilesConfig(typeKey: string): Promise<IIntegrationStoredProfiles | null> {
    return this.profileService.readStoredProfiles(this.normalize(typeKey));
  }

  async readStoredProvidersConfig(typeKey: string): Promise<IIntegrationStoredProvider[] | null> {
    return this.storedProviderService.readStoredProvidersConfig(typeKey);
  }

  sanitizeResolvedConfig(typeKey: string, providerKey: string, config: Record<string, any> = {}): Record<string, any> {
    return this.storedProviderService.sanitizeResolvedConfig(typeKey, providerKey, config);
  }

  async setProviderEnabled(typeKey: string, providerId: string, enabled: boolean) {
    await this.storedProviderService.setProviderEnabled(typeKey, providerId, enabled);
  }

  async removeProvider(typeKey: string, providerId: string) {
    await this.storedProviderService.removeProvider(typeKey, providerId);
  }

  private normalize(value: string) {
    return CoreServices.getInstance().content.sanitizeKey(value);
  }
}

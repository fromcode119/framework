/**
 * IntegrationResolverService
 *
 * Provider-resolution engine for IntegrationRegistry. Walks stored providers,
 * stored profiles, environment candidates and the default provider to produce
 * the ordered list of resolved providers for a given integration type.
 * Extracted from IntegrationRegistry to keep that class under the size limit;
 * all behavior is identical and the registry delegates to this service.
 */

import { Logger } from '../logging';
import { IntegrationStoredProviderService } from './integration-stored-provider-service';
import {
  IntegrationResolved,
  IntegrationStoredProfiles,
  IntegrationTypeRuntime,
} from './integration-registry.interfaces';

export class IntegrationResolverService {
  constructor(
    private readonly types: Map<string, IntegrationTypeRuntime<any>>,
    private readonly storedProviderService: IntegrationStoredProviderService,
    private readonly logger: Logger,
    private readonly normalize: (value: string) => string,
    private readonly readStoredProfilesConfig: (typeKey: string) => Promise<IntegrationStoredProfiles | null>,
  ) {}

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
    const storedProviders = preferStored ? await this.storedProviderService.readStoredProvidersInternal(normalizedType) : null;
    const storedProfiles = preferStored ? await this.readStoredProfilesConfig(normalizedType) : null;
    const envCandidate = runtime.definition.resolveFromEnv?.() || null;

    if (storedProviders?.length) {
      const enabledProviders = storedProviders.filter((entry) => entry.enabled !== false);
      const resolvedFromStored: IntegrationResolved<TInstance>[] = [];
      for (const entry of enabledProviders) {
        if (!entry?.providerKey || !runtime.providers.has(entry.providerKey)) continue;
        const provider = runtime.providers.get(entry.providerKey);
        if (!provider) continue;
        const resolvedConfig = this.storedProviderService.resolveRuntimeConfig(provider, entry.config || {});
        const normalizedConfig = provider.normalizeConfig
          ? provider.normalizeConfig(resolvedConfig)
          : resolvedConfig;
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
          const resolvedConfig = this.storedProviderService.resolveRuntimeConfig(provider, activeProfile.config || {});
          const normalizedConfig = provider.normalizeConfig
            ? provider.normalizeConfig(resolvedConfig)
            : resolvedConfig;
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
}

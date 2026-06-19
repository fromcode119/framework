/**
 * IntegrationConfigReadService
 *
 * Builds the enriched, sanitized configuration summaries returned by
 * IntegrationManager.listConfigs() / getConfig(). Extracted from
 * IntegrationManager to keep that class under the size limit; behavior is
 * identical and the manager delegates to this service.
 */

import { IntegrationRegistry } from './integration-registry';

export class IntegrationConfigReadService {
  constructor(
    private readonly registry: IntegrationRegistry,
    private readonly normalizeKey: (type: string) => string,
  ) {}

  async listConfigs() {
    const summaries = this.registry.listTypes();
    const enriched = await Promise.all(
      summaries.map(async (summary) => {
        const active = await this.registry.resolve(summary.key).catch(() => null);
        const stored = await this.registry.readStoredConfig(summary.key).catch(() => null);
        const storedProviders = await this.registry.readStoredProvidersConfig(summary.key).catch(() => null);
        const storedProfiles = await this.registry.readStoredProfilesConfig(summary.key).catch(() => null);
        return {
          ...summary,
          active: active
            ? {
                provider: active.providerKey,
                source: active.source,
                config: this.registry.sanitizeResolvedConfig(summary.key, active.providerKey, active.config)
              }
            : null,
          stored,
          storedProviders,
          storedProfiles: this.sanitizeStoredProfiles(summary.key, storedProfiles),
          activeProfileId: storedProfiles?.activeProfileId || null
        };
      })
    );

    return enriched;
  }

  async getConfig(type: string) {
    const normalizedType = this.normalizeKey(type);
    const summary = this.registry.getTypeSummary(normalizedType);
    if (!summary) return null;

    const active = await this.registry.resolve(normalizedType).catch(() => null);
    const stored = await this.registry.readStoredConfig(normalizedType).catch(() => null);
    const storedProviders = await this.registry.readStoredProvidersConfig(normalizedType).catch(() => null);
    const storedProfiles = await this.registry.readStoredProfilesConfig(normalizedType).catch(() => null);

    return {
      ...summary,
      active: active
        ? {
            provider: active.providerKey,
            source: active.source,
            config: this.registry.sanitizeResolvedConfig(normalizedType, active.providerKey, active.config)
          }
        : null,
      stored,
      storedProviders,
      storedProfiles: this.sanitizeStoredProfiles(normalizedType, storedProfiles),
      activeProfileId: storedProfiles?.activeProfileId || null
    };
  }

  private sanitizeStoredProfiles(typeKey: string, storedProfiles: any) {
    if (!storedProfiles?.profiles?.length) {
      return storedProfiles;
    }

    return {
      ...storedProfiles,
      profiles: storedProfiles.profiles.map((profile: any) => ({
        ...profile,
        config: this.registry.sanitizeResolvedConfig(typeKey, String(profile?.providerKey || ''), profile?.config || {}),
      })),
    };
  }
}

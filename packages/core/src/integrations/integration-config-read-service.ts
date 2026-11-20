/**
 * IntegrationConfigReadService
 *
 * Builds the enriched, sanitized configuration summaries returned by
 * IntegrationManager.listConfigs() / getConfig(). Extracted from
 * IntegrationManager to keep that class under the size limit; behavior is
 * identical and the manager delegates to this service.
 */

import { IntegrationRegistry } from '@core/integrations/integration-registry';

export class IntegrationConfigReadService {
  constructor(
    private readonly registry: IntegrationRegistry,
    private readonly normalizeKey: (type: string) => string,
    /**
     * Where the type's work actually goes for the site in scope, when that differs from naming its
     * provider — today only email (`EmailDeliveryRoute`). `null` when there is nothing to add.
     */
    private readonly describeRoute: (typeKey: string, source: unknown) => Promise<string | null>,
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
          active: await this.activeSummary(summary.key, active),
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
      active: await this.activeSummary(normalizedType, active),
      stored,
      storedProviders,
      storedProfiles: this.sanitizeStoredProfiles(normalizedType, storedProfiles),
      activeProfileId: storedProfiles?.activeProfileId || null
    };
  }

  private async activeSummary(typeKey: string, active: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!active) return null;
    return {
      provider: active.providerKey,
      source: active.source,
      route: await this.describeRoute(typeKey, active.source),
      config: this.registry.sanitizeResolvedConfig(typeKey, active.providerKey, active.config),
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

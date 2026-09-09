import { IntegrationRegistry } from '@core/integrations/integration-registry';

/**
 * The WRITE half of integration configuration: storing a provider's settings, enabling and removing
 * providers, and the profile lifecycle.
 *
 * Split out of `IntegrationManager`, which had grown past the 300-line limit, and split along the
 * seam that was already there: `IntegrationConfigReadService` owns reading. Every method here does
 * the same two things — write through the registry, then re-resolve the type so the live instance
 * matches what was just stored — so the pair belongs together and nowhere else.
 *
 * `refreshType` is injected rather than imported because it is the manager's job: only the manager
 * knows which types hold a live instance (email, storage, cache) and which are resolved on demand.
 * A write that skipped it would leave the running system on the previous configuration with the new
 * one saved and apparently active, which is the failure this whole class exists to prevent.
 */
export class IntegrationConfigWriteService {
  constructor(
    private readonly registry: IntegrationRegistry,
    private readonly normalizeKey: (type: string) => string,
    private readonly refreshType: (normalizedType: string) => Promise<void>,
    private readonly getConfig: (normalizedType: string) => Promise<unknown>,
  ) {}

  async updateConfig(
    type: string,
    provider: string,
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
    const normalizedType = this.normalizeKey(type);
    await this.registry.updateStoredConfig(normalizedType, provider, config || {}, options);
    return this.refreshAndRead(normalizedType);
  }

  async setProviderEnabled(type: string, providerId: string, enabled: boolean) {
    const normalizedType = this.normalizeKey(type);
    await this.registry.setProviderEnabled(normalizedType, providerId, enabled);
    return this.refreshAndRead(normalizedType);
  }

  async removeProvider(type: string, providerId: string) {
    const normalizedType = this.normalizeKey(type);
    await this.registry.removeProvider(normalizedType, providerId);
    return this.refreshAndRead(normalizedType);
  }

  async activateProfile(type: string, profileId: string) {
    const normalizedType = this.normalizeKey(type);
    await this.registry.setActiveProfile(normalizedType, profileId);
    return this.refreshAndRead(normalizedType);
  }

  async renameProfile(type: string, profileId: string, profileName: string) {
    const normalizedType = this.normalizeKey(type);
    await this.registry.renameProfile(normalizedType, profileId, profileName);
    return this.refreshAndRead(normalizedType);
  }

  async deleteProfile(type: string, profileId: string) {
    const normalizedType = this.normalizeKey(type);
    await this.registry.deleteProfile(normalizedType, profileId);
    return this.refreshAndRead(normalizedType);
  }

  /** Re-resolve the type, then return what an operator would now read back for it. */
  private async refreshAndRead(normalizedType: string) {
    await this.refreshType(normalizedType);
    return this.getConfig(normalizedType);
  }
}

import { IntegrationRegistry } from './integration-registry';
import type { IntegrationTypeDefinition, IntegrationProviderDefinition } from './integration-registry.interfaces';
import { EmailManager } from '@fromcode119/email';

type EmailSender = Pick<EmailManager, 'send'>;
import { MediaManager } from '@fromcode119/media';
import { CacheManager } from '@fromcode119/cache';
import { Logger } from '../logging';
import { EmailIntegrationDefinition } from './providers/email-integration-definition';
import { StorageIntegrationDefinition } from './providers/storage-provider';
import { CacheIntegrationDefinition } from './providers/cache-provider';
import { SsoIntegrationDefinition } from './providers/sso-provider';
import { CoreServices } from '../services';
import { IntegrationConfigReadService } from './integration-config-read-service';
import { IntegrationCoreRefreshService } from './integration-core-refresh-service';

export class IntegrationManager {
  private registry: IntegrationRegistry;
  private configReader: IntegrationConfigReadService;
  private coreRefresh: IntegrationCoreRefreshService;
  private logger: Logger;
  private projectRoot: string;
  private instances: Map<string, any> = new Map();

  // Integration instances
  public email!: EmailSender;
  public storage!: MediaManager;
  public cache!: CacheManager;

  constructor(db: any, projectRoot: string, logger?: Logger) {
    this.projectRoot = projectRoot;
    this.logger = logger || new Logger({ namespace: 'integration-manager' });
    this.registry = new IntegrationRegistry(db, this.logger);
    this.configReader = new IntegrationConfigReadService(this.registry, (type: string) => this.normalizeKey(type));
    this.coreRefresh = new IntegrationCoreRefreshService(this.registry, this.logger, this.projectRoot);

    this.registerCoreIntegrations();
  }

  /**
   * Register all core integration types and their providers
   */
  private registerCoreIntegrations() {
    this.registry.registerType(EmailIntegrationDefinition.definition);
    this.registry.registerType(StorageIntegrationDefinition.definition);
    this.registry.registerType(CacheIntegrationDefinition.definition);
    this.registry.registerType(SsoIntegrationDefinition.definition);
    // AI integration is now registered by the AI core extension
    // (see packages/ai/src/extension.ts)
  }

  /**
   * Register a new integration type
   */
  public registerType(definition: IntegrationTypeDefinition) {
    this.registry.registerType(definition);
    this.logger.info(`Registered integration type: ${definition.key}`);
  }

  /**
   * Unregister an integration type
   */
  public unregisterType(typeKey: string): boolean {
    const result = this.registry.unregisterType(typeKey);
    if (result) {
      this.logger.info(`Unregistered integration type: ${typeKey}`);
    }
    return result;
  }

  /**
   * Register a new provider for an existing integration type
   */
  public registerProvider(typeKey: string, provider: IntegrationProviderDefinition) {
    this.registry.registerProvider(typeKey, provider);
    this.logger.info(`Registered provider "${provider.key}" for type "${typeKey}"`);
  }

  /**
   * Initialize all core integrations
   * Should be called after database migrations are complete
   */
  async initialize() {
    // After migrations complete, stored integration settings should override env defaults.
    await this.refreshAll(true);
  }

  /**
   * Get an instantiated integration by its type key
   */
  async get<T = any>(typeKey: string, preferStored: boolean = true): Promise<T> {
    const normalized = this.normalizeKey(typeKey);
    
    // Fast path for core integrations
    if (normalized === 'email') return this.email as any;
    if (normalized === 'storage') return this.storage as any;
    if (normalized === 'cache') return this.cache as any;

    if (this.instances.has(normalized)) {
      return this.instances.get(normalized);
    }

    try {
      const { instance } = await this.registry.instantiate<T>(normalized, { 
        preferStored,
        context: { projectRoot: this.projectRoot, logger: this.logger }
      });
      this.instances.set(normalized, instance);
      return instance;
    } catch (error: any) {
      this.logger.error(`Failed to get integration "${normalized}": ${error.message}`);
      throw error;
    }
  }

  async instantiateWithConfig<T = any>(
    typeKey: string,
    providerKey: string,
    config: Record<string, any> = {}
  ): Promise<{ instance: T; resolved: any }> {
    const normalized = this.normalizeKey(typeKey);
    return this.registry.instantiateWithConfig<T>(normalized, providerKey, config, {
      context: { projectRoot: this.projectRoot, logger: this.logger },
    });
  }

  /**
   * Refresh all integrations from stored or environment configuration
   */
  async refreshAll(preferStored: boolean = true) {
    // Refresh core integrations
    await this.refreshEmail(preferStored);
    await this.refreshStorage(preferStored);
    await this.refreshCache(preferStored);
    
    // Clear dynamic instances so they are re-instantiated on next get()
    this.instances.clear();
  }

  /**
   * Refresh email integration
   */
  async refreshEmail(preferStored: boolean = true) {
    const { email, resolved } = await this.coreRefresh.refreshEmail(preferStored);
    this.email = email;
    return resolved;
  }

  /**
   * Refresh storage integration
   */
  async refreshStorage(preferStored: boolean = true) {
    const { storage, resolved } = await this.coreRefresh.refreshStorage(preferStored);
    this.storage = storage;
    return resolved;
  }

  /**
   * Refresh cache integration
   */
  async refreshCache(preferStored: boolean = true) {
    const { cache, resolved } = await this.coreRefresh.refreshCache(preferStored);
    this.cache = cache;
    return resolved;
  }

  /**
   * List all registered integration types with their active and stored configurations
   */
  async listConfigs() {
    return this.configReader.listConfigs();
  }

  /**
   * Get configuration for a specific integration type
   */
  async getConfig(type: string) {
    return this.configReader.getConfig(type);
  }

  /**
   * Update configuration for a specific integration type
   */
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
    } = {}
  ) {
    const normalizedType = this.normalizeKey(type);
    await this.registry.updateStoredConfig(normalizedType, provider, config || {}, options);
    return this.refreshTypeAndGetConfig(normalizedType);
  }

  async setProviderEnabled(type: string, providerId: string, enabled: boolean) {
    const normalizedType = this.normalizeKey(type);
    await this.registry.setProviderEnabled(normalizedType, providerId, enabled);
    return this.refreshTypeAndGetConfig(normalizedType);
  }

  async removeProvider(type: string, providerId: string) {
    const normalizedType = this.normalizeKey(type);
    await this.registry.removeProvider(normalizedType, providerId);
    return this.refreshTypeAndGetConfig(normalizedType);
  }

  async activateProfile(type: string, profileId: string) {
    const normalizedType = this.normalizeKey(type);
    await this.registry.setActiveProfile(normalizedType, profileId);
    return this.refreshTypeAndGetConfig(normalizedType);
  }

  async renameProfile(type: string, profileId: string, profileName: string) {
    const normalizedType = this.normalizeKey(type);
    await this.registry.renameProfile(normalizedType, profileId, profileName);
    return this.refreshTypeAndGetConfig(normalizedType);
  }

  async deleteProfile(type: string, profileId: string) {
    const normalizedType = this.normalizeKey(type);
    await this.registry.deleteProfile(normalizedType, profileId);
    return this.refreshTypeAndGetConfig(normalizedType);
  }

  /**
   * Normalize integration type key
   */
  private normalizeKey(type: string) {
    return CoreServices.getInstance().content.sanitizeKey(type);
  }

  private async refreshTypeAndGetConfig(normalizedType: string) {
    await this.refreshType(normalizedType);
    return this.getConfig(normalizedType);
  }

  private async refreshType(normalizedType: string) {
    if (normalizedType === 'email') {
      await this.refreshEmail(true);
      return;
    }
    if (normalizedType === 'storage') {
      await this.refreshStorage(true);
      return;
    }
    if (normalizedType === 'cache') {
      await this.refreshCache(true);
      return;
    }

    this.instances.delete(normalizedType);
  }
}
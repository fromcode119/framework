import { IntegrationRegistry } from './integration-registry';
import type { IntegrationTypeDefinition, IntegrationProviderDefinition } from './integration-registry.interfaces';
import { EmailManager, EmailFactory, EmailOptions } from '@fromcode119/email';

type EmailSender = Pick<EmailManager, 'send'>;
import { MediaManager, StorageFactory } from '@fromcode119/media';
import { CacheManager, CacheFactory } from '@fromcode119/cache';
import { Logger } from '@fromcode119/sdk';
import { EmailIntegrationDefinition } from './providers/email-provider';
import { StorageIntegrationDefinition } from './providers/storage-provider';
import { CacheIntegrationDefinition } from './providers/cache-provider';
import { SsoIntegrationDefinition } from './providers/sso-provider';
import { CoreServices } from '../services';
import path from 'path';
import { MultiProviderEmailSender } from './multi-provider-email-sender';

export class IntegrationManager {
  private registry: IntegrationRegistry;
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
    
    this.registerCoreIntegrations();
  }

  /**
   * Register all core integration types and their providers
   */
  private registerCoreIntegrations() {
    this.registry.registerType(EmailIntegrationDefinition);
    this.registry.registerType(StorageIntegrationDefinition);
    this.registry.registerType(CacheIntegrationDefinition);
    this.registry.registerType(SsoIntegrationDefinition);
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
    // Refresh all core integrations from stored or env config
    await this.refreshAll(false);
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
    try {
      const resolvedInstances = await this.registry.instantiateMany<EmailManager>('email', {
        preferStored,
        context: { projectRoot: this.projectRoot, logger: this.logger }
      });
      if (!resolvedInstances.length) {
        throw new Error('No email providers resolved');
      }

      if (resolvedInstances.length === 1) {
        const only = resolvedInstances[0];
        this.email = only.instance;
        this.logger.info(`Email integration active: ${only.resolved.providerKey} (${only.resolved.source})`);
        return only.resolved;
      }

      this.email = new MultiProviderEmailSender(
        resolvedInstances.map((entry) => ({ key: entry.resolved.providerKey, sender: entry.instance })),
        this.logger
      );
      const providerKeys = resolvedInstances.map((entry) => entry.resolved.providerKey).join(', ');
      this.logger.info(`Email integrations active (fan-out): ${providerKeys} (stored)`);
      return resolvedInstances.map((entry) => entry.resolved);
    } catch (error: any) {
      this.logger.error(`Failed to initialize email integration: ${error.message}. Falling back to mock driver.`);
      this.email = new EmailManager(EmailFactory.create('mock', {}));
      return null;
    }
  }

  /**
   * Refresh storage integration
   */
  async refreshStorage(preferStored: boolean = true) {
    try {
      const { instance, resolved } = await this.registry.instantiate<MediaManager>('storage', { 
        preferStored,
        context: { projectRoot: this.projectRoot, logger: this.logger }
      });
      this.storage = instance;
      this.logger.info(`Storage integration active: ${resolved.providerKey} (${resolved.source})`);
      return resolved;
    } catch (error: any) {
      this.logger.error(`Failed to initialize storage integration: ${error.message}. Falling back to default local driver.`);
      // Fallback to local driver to prevent system-wide crashes
      const uploadDir = process.env.STORAGE_UPLOAD_DIR || path.resolve(this.projectRoot, 'public/uploads');
      const publicUrl = process.env.STORAGE_PUBLIC_URL || '/uploads';
      this.storage = new MediaManager(StorageFactory.create('local', { uploadDir, publicUrlBase: publicUrl }));
      return null;
    }
  }

  /**
   * Refresh cache integration
   */
  async refreshCache(preferStored: boolean = true) {
    try {
      const { instance, resolved } = await this.registry.instantiate<CacheManager>('cache', { 
        preferStored,
        context: { projectRoot: this.projectRoot, logger: this.logger }
      });
      this.cache = instance;
      this.logger.info(`Cache integration active: ${resolved.providerKey} (${resolved.source})`);
      return resolved;
    } catch (error: any) {
      this.logger.error(`Failed to initialize cache integration: ${error.message}. Falling back to memory driver.`);
      this.cache = new CacheManager(CacheFactory.create('memory', {}));
      return null;
    }
  }

  /**
   * List all registered integration types with their active and stored configurations
   */
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
                config: active.config
              }
            : null,
          stored,
          storedProviders,
          storedProfiles,
          activeProfileId: storedProfiles?.activeProfileId || null
        };
      })
    );

    return enriched;
  }

  /**
   * Get configuration for a specific integration type
   */
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
            config: active.config
          }
        : null,
      stored,
      storedProviders,
      storedProfiles,
      activeProfileId: storedProfiles?.activeProfileId || null
    };
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

    // Refresh if it's a core integration
    if (normalizedType === 'email') await this.refreshEmail(true);
    else if (normalizedType === 'storage') await this.refreshStorage(true);
    else if (normalizedType === 'cache') await this.refreshCache(true);
    else {
      // Clear instance so it re-instantiates with new config on next get()
      this.instances.delete(normalizedType);
    }

    return this.getConfig(normalizedType);
  }

  async setProviderEnabled(type: string, providerId: string, enabled: boolean) {
    const normalizedType = this.normalizeKey(type);
    await this.registry.setProviderEnabled(normalizedType, providerId, enabled);

    if (normalizedType === 'email') await this.refreshEmail(true);
    else if (normalizedType === 'storage') await this.refreshStorage(true);
    else if (normalizedType === 'cache') await this.refreshCache(true);
    else this.instances.delete(normalizedType);

    return this.getConfig(normalizedType);
  }

  async removeProvider(type: string, providerId: string) {
    const normalizedType = this.normalizeKey(type);
    await this.registry.removeProvider(normalizedType, providerId);

    if (normalizedType === 'email') await this.refreshEmail(true);
    else if (normalizedType === 'storage') await this.refreshStorage(true);
    else if (normalizedType === 'cache') await this.refreshCache(true);
    else this.instances.delete(normalizedType);

    return this.getConfig(normalizedType);
  }

  async activateProfile(type: string, profileId: string) {
    const normalizedType = this.normalizeKey(type);
    await this.registry.setActiveProfile(normalizedType, profileId);

    if (normalizedType === 'email') await this.refreshEmail(true);
    else if (normalizedType === 'storage') await this.refreshStorage(true);
    else if (normalizedType === 'cache') await this.refreshCache(true);
    else this.instances.delete(normalizedType);

    return this.getConfig(normalizedType);
  }

  async renameProfile(type: string, profileId: string, profileName: string) {
    const normalizedType = this.normalizeKey(type);
    await this.registry.renameProfile(normalizedType, profileId, profileName);

    if (normalizedType === 'email') await this.refreshEmail(true);
    else if (normalizedType === 'storage') await this.refreshStorage(true);
    else if (normalizedType === 'cache') await this.refreshCache(true);
    else this.instances.delete(normalizedType);

    return this.getConfig(normalizedType);
  }

  async deleteProfile(type: string, profileId: string) {
    const normalizedType = this.normalizeKey(type);
    await this.registry.deleteProfile(normalizedType, profileId);

    if (normalizedType === 'email') await this.refreshEmail(true);
    else if (normalizedType === 'storage') await this.refreshStorage(true);
    else if (normalizedType === 'cache') await this.refreshCache(true);
    else this.instances.delete(normalizedType);

    return this.getConfig(normalizedType);
  }

  /**
   * Normalize integration type key
   */
  private normalizeKey(type: string) {
    return CoreServices.getInstance().content.sanitizeKey(type);
  }
}
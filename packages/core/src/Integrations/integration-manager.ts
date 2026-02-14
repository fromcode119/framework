import { IntegrationRegistry, IntegrationTypeDefinition, IntegrationProviderDefinition } from './integration-registry';
import { EmailManager, EmailFactory } from '@fromcode/email';
import { MediaManager, StorageFactory } from '@fromcode/media';
import { CacheManager, CacheFactory } from '@fromcode/cache';
import { Logger } from '../logging/logger';
import { EmailIntegrationDefinition } from './providers/email-provider';
import { StorageIntegrationDefinition } from './providers/storage-provider';
import { CacheIntegrationDefinition } from './providers/cache-provider';
import { sanitizeKey } from '../utils';
import path from 'path';

/**
 * IntegrationManager
 * 
 * Manages all system integrations (email, storage, cache) and provides
 * a unified interface for configuration and instantiation.
 * 
 * Separates integration concerns from PluginManager to improve code organization.
 */
export class IntegrationManager {
  private registry: IntegrationRegistry;
  private logger: Logger;
  private projectRoot: string;
  private instances: Map<string, any> = new Map();

  // Integration instances
  public email!: EmailManager;
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
  }

  /**
   * Register a new integration type
   */
  public registerType(definition: IntegrationTypeDefinition) {
    this.registry.registerType(definition);
    this.logger.info(`Registered integration type: ${definition.key}`);
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
      const { instance, resolved } = await this.registry.instantiate<EmailManager>('email', { 
        preferStored,
        context: { projectRoot: this.projectRoot, logger: this.logger }
      });
      this.email = instance;
      this.logger.info(`Email integration active: ${resolved.providerKey} (${resolved.source})`);
      return resolved;
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
        return {
          ...summary,
          active: active
            ? {
                provider: active.providerKey,
                source: active.source,
                config: active.config
              }
            : null,
          stored
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

    return {
      ...summary,
      active: active
        ? {
            provider: active.providerKey,
            source: active.source,
            config: active.config
          }
        : null,
      stored
    };
  }

  /**
   * Update configuration for a specific integration type
   */
  async updateConfig(type: string, provider: string, config: Record<string, any> = {}) {
    const normalizedType = this.normalizeKey(type);
    await this.registry.updateStoredConfig(normalizedType, provider, config || {});

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

  /**
   * Normalize integration type key
   */
  private normalizeKey(type: string) {
    return sanitizeKey(type);
  }
}

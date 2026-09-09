import { IntegrationRegistry } from '@core/integrations/integration-registry';
import { CoreIntegrationRegistration } from '@core/integrations/core-integration-registration';
import type { IIntegrationTypeDefinition } from '@core/integrations/interfaces/integration-type-definition.interface';
import type { IIntegrationProviderDefinition } from '@core/integrations/interfaces/integration-provider-definition.interface';
import type { IEmailDriver } from '@fromcode119/email';
import { MediaManager } from '@fromcode119/media';
import { CacheManager } from '@fromcode119/cache';
import type { QueueManager } from '@fromcode119/queue';
import { Logger } from '@core/logging';
import { IntegrationTenantAccess } from '@core/integrations/integration-tenant-access';
import { IntegrationTenantResolver } from '@core/integrations/integration-tenant-resolver';
import { TenantScopedIntegrationFactory } from '@core/integrations/tenant-scoped-integration-factory';
import { CoreServices } from '@core/services';
import { IntegrationConfigReadService } from '@core/integrations/integration-config-read-service';
import { IntegrationConfigWriteService } from '@core/integrations/integration-config-write-service';
import { IntegrationCoreRefreshService } from '@core/integrations/integration-core-refresh-service';
import { RequestContextUtils } from '@core/context/request-context';

export class IntegrationManager {
  private registry: IntegrationRegistry;
  private configReader: IntegrationConfigReadService;
  private configWriter: IntegrationConfigWriteService;
  /** Per-site resolution of the core integrations; shares this manager's own instance map. */
  private tenantResolver!: IntegrationTenantResolver;
  /** Builds the tenant-scoped wrappers; knows which method names must stay synchronous. */
  private scopedFactory!: TenantScopedIntegrationFactory;
  private coreRefresh: IntegrationCoreRefreshService;
  private logger: Logger;
  private projectRoot: string;
  /**
   * Resolved integration instances, keyed by TENANT + type.
   *
   * An instance carries the stored configuration of one tenant — a courier's credentials, a payment
   * gateway's secret. Keying this by type alone made it process-wide: whichever tenant (or the
   * untenanted boot) resolved a type first served every request afterwards. On this deployment that
   * showed up as a configured Econt reading back with an empty username, because the platform-level
   * record won the cache; the same sharing would hand one tenant another tenant's live credential.
   */
  private instances: Map<string, any> = new Map();

  // Integration instances
  private readonly db: any; // eslint-disable-line @typescript-eslint/no-explicit-any

  public email!: IEmailDriver;

  /** The driver resolved with no tenant in scope: framework mail, and the fallback for untenanted work. */
  private platformEmail!: IEmailDriver;
  public storage!: MediaManager;
  public cache!: CacheManager;
  public queue!: QueueManager;

  /** The instances resolved with no tenant in scope: framework work, and the fallback for each field. */
  private platformStorage!: MediaManager;
  private platformCache!: CacheManager;
  private platformQueue!: QueueManager;

  constructor(db: any, projectRoot: string, logger?: Logger) {
    this.db = db;
    this.projectRoot = projectRoot;
    this.logger = logger || new Logger({ namespace: 'integration-manager' });
    this.registry = new IntegrationRegistry(db, this.logger);
    this.configReader = new IntegrationConfigReadService(this.registry, (type: string) => this.normalizeKey(type));
    this.configWriter = new IntegrationConfigWriteService(
      this.registry,
      (type: string) => this.normalizeKey(type),
      (normalizedType: string) => this.refreshType(normalizedType),
      (normalizedType: string) => this.getConfig(normalizedType),
    );
    this.coreRefresh = new IntegrationCoreRefreshService(this.registry, this.logger, this.projectRoot);
    // After coreRefresh, which it resolves through.
    this.tenantResolver = new IntegrationTenantResolver(this.db, this.coreRefresh, this.logger, this.instances);
    this.scopedFactory = new TenantScopedIntegrationFactory(this.coreRefresh, this.tenantResolver);

    CoreIntegrationRegistration.applyTo(this.registry);

    // The tenancy middleware warms a site's integrations when it binds the request, the same way it
    // warms the plugin and theme gates, so the SYNCHRONOUS methods above always have an answer. It
    // reaches them through this static rather than through a manager reference it does not have.
    IntegrationTenantAccess.configure((tenantId, type) => this.tenantResolver.warmOne(tenantId, type));
  }

  /**
   * Register a new integration type
   */
  public registerType(definition: IIntegrationTypeDefinition) {
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
  public registerProvider(typeKey: string, provider: IIntegrationProviderDefinition) {
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
    if (normalized === 'queue') return this.queue as any;

    const instanceKey = this.instanceKey(normalized);
    if (this.instances.has(instanceKey)) {
      return this.instances.get(instanceKey);
    }

    try {
      const { instance } = await this.registry.instantiate<T>(normalized, { 
        preferStored,
        context: { projectRoot: this.projectRoot, logger: this.logger }
      });
      this.instances.set(instanceKey, instance);
      return instance;
    } catch (error: any) {
      this.logger.error(`Failed to get integration "${normalized}": ${error.message}`);
      throw error;
    }
  }

  /** Cache key for a resolved instance: the request's tenant (empty for platform-level work) plus the type. */
  private instanceKey(normalizedType: string): string {
    return `${RequestContextUtils.getTenantId() ?? ''}::${normalizedType}`;
  }

  /** Drops the current tenant's instance of a type, so the next `get()` re-reads that tenant's config. */
  private forgetInstance(normalizedType: string): void {
    this.instances.delete(this.instanceKey(normalizedType));
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
    await this.refreshQueue(preferStored);
    
    // Clear dynamic instances so they are re-instantiated on next get()
    this.instances.clear();
  }

  /**
   * The four refreshes each do the same two things: resolve the PLATFORM instance and keep it as the
   * fallback, then replace the public field with a tenant-scoped wrapper around it. The wrapping
   * itself, and the method names that must stay synchronous, live in
   * `TenantScopedIntegrationFactory`.
   */
  async refreshEmail(preferStored: boolean = true) {
    const { email, resolved } = await this.coreRefresh.refreshEmail(preferStored);
    this.platformEmail = email;
    this.email = this.scopedFactory.email(() => this.platformEmail, this.db);
    return resolved;
  }

  async refreshStorage(preferStored: boolean = true) {
    const { storage, resolved } = await this.coreRefresh.refreshStorage(preferStored);
    this.platformStorage = storage;
    this.storage = this.scopedFactory.storage(() => this.platformStorage);
    return resolved;
  }

  async refreshQueue(preferStored: boolean = true) {
    const { queue, resolved } = await this.coreRefresh.refreshQueue(preferStored);
    this.platformQueue = queue;
    this.queue = this.scopedFactory.queue(() => this.platformQueue);
    return resolved;
  }

  async refreshCache(preferStored: boolean = true) {
    const { cache, resolved } = await this.coreRefresh.refreshCache(preferStored);
    this.platformCache = cache;
    this.cache = this.scopedFactory.cache(() => this.platformCache);
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
   * Configuration WRITES delegate to `IntegrationConfigWriteService`, the mirror of the read service
   * above. Each one stores through the registry and then re-resolves the type, so what is running
   * always matches what was just saved.
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
    return this.configWriter.updateConfig(type, provider, config, options);
  }

  async setProviderEnabled(type: string, providerId: string, enabled: boolean) {
    return this.configWriter.setProviderEnabled(type, providerId, enabled);
  }

  async removeProvider(type: string, providerId: string) {
    return this.configWriter.removeProvider(type, providerId);
  }

  async activateProfile(type: string, profileId: string) {
    return this.configWriter.activateProfile(type, profileId);
  }

  async renameProfile(type: string, profileId: string, profileName: string) {
    return this.configWriter.renameProfile(type, profileId, profileName);
  }

  async deleteProfile(type: string, profileId: string) {
    return this.configWriter.deleteProfile(type, profileId);
  }

  /**
   * Normalize integration type key
   */
  private normalizeKey(type: string) {
    return CoreServices.getInstance().content.sanitizeKey(type);
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

    this.forgetInstance(normalizedType);
  }

}

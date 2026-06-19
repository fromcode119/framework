import { Logger } from '../logging';
import { IDatabaseManager } from '@fromcode119/database';
import * as path from 'path';
import * as fs from 'fs';
import {
  LoadedCoreExtension,
  CoreExtensionModule,
} from './types';
import { CoreExtensionStateStore } from './core-extension-state-store';
import { CoreExtensionContextFactory } from './core-extension-context-factory';
import { CoreExtensionDiscoveryService } from './core-extension-discovery-service';

/**
 * CoreExtensionManager
 * 
 * Manages optional core packages (core extensions) that can be enabled/disabled
 * at runtime. Similar to PluginManager but for packages in packages/ directory.
 */
export class CoreExtensionManager {
  private extensions: Map<string, LoadedCoreExtension> = new Map();
  private stateStore: CoreExtensionStateStore;
  private contextFactory: CoreExtensionContextFactory;
  private discoveryService: CoreExtensionDiscoveryService;
  private logger: Logger;
  private db: IDatabaseManager;
  private packagesRoot: string;
  private capabilities: Set<string> = new Set();
  private registeredApiRoutes: Map<string, any> = new Map();
  private registeredAdminSlots: Map<string, Array<{ slot: string; component: any; priority: number; extensionSlug: string }>> = new Map(); // Store admin UI slots by slot name

  // Framework services that extensions can use
  private services: {
    integrations?: any;
    hooks?: any;
    plugins?: any;
  } = {};

  constructor(
    db: IDatabaseManager,
    packagesRoot: string,
    logger?: Logger
  ) {
    this.db = db;
    this.packagesRoot = packagesRoot;
    this.logger = logger || new Logger({ namespace: 'core-extensions' });
    this.stateStore = new CoreExtensionStateStore(this.db, this.logger);
    this.contextFactory = new CoreExtensionContextFactory(
      this.db,
      this.logger,
      this.capabilities,
      this.registeredApiRoutes,
      this.registeredAdminSlots,
      () => this.services,
    );
    this.discoveryService = new CoreExtensionDiscoveryService(this.logger);
  }

  /**
   * Set framework services that extensions can access
   */
  public setServices(services: {
    integrations?: any;
    hooks?: any;
    plugins?: any;
  }) {
    this.services = services;
  }

  /**
   * Discover and load core extensions from packages directory
   */
  public async discover(): Promise<void> {
    this.logger.info('Discovering core extensions...');

    try {
      // Load saved states from database
      await this.stateStore.loadStates();

      const { packagesRoot, extensions } = await this.discoveryService.discover(this.packagesRoot);
      this.packagesRoot = packagesRoot;
      for (const [slug, extension] of extensions) {
        this.extensions.set(slug, extension);
      }
    } catch (error) {
      this.logger.error('Failed to discover core extensions:', error);
      throw error;
    }
  }

  /**
   * Initialize all enabled extensions
   */
  public async initializeAll(): Promise<void> {
    this.logger.info('Initializing core extensions...');
    
    for (const [slug, extension] of this.extensions) {
      const state = this.stateStore.get(slug);
      const isEnabled = state?.enabled ?? this.stateStore.isEnabledByDefault(slug);
      
      if (isEnabled) {
        await this.initializeExtension(slug);
      }
    }
    
    this.logger.info('Core extensions initialized');
  }

  /**
   * Initialize a specific extension
   */
  public async initializeExtension(slug: string): Promise<void> {
    const extension = this.extensions.get(slug);
    
    if (!extension) {
      throw new Error(`Core extension not found: ${slug}`);
    }
    
    if (extension.state === 'active' || extension.state === 'loaded') {
      this.logger.warn(`Extension ${slug} already initialized`);
      return;
    }
    
    try {
      this.logger.info(`Initializing extension: ${slug}`);
      
      // Load the module
      const entryPoint = extension.manifest.main || 'src/extension.ts';
      const modulePath = path.join(extension.path, entryPoint);
      
      if (!fs.existsSync(modulePath)) {
        throw new Error(`Extension entry point not found: ${modulePath}`);
      }
      
      // Dynamic import of the extension module.
      // Supports both named-function exports and class-based extensions (single class with static lifecycle methods).
      const rawModule = await import(modulePath);
      const rawExports = Object.values(rawModule);
      const module: CoreExtensionModule = (
        rawExports.length === 1 &&
        typeof rawExports[0] === 'function' &&
        ('onInit' in rawExports[0] || 'onEnable' in rawExports[0] || 'onDisable' in rawExports[0])
      ) ? (rawExports[0] as CoreExtensionModule) : rawModule;
      extension.module = module;
      extension.state = 'loaded';
      
      // Create extension context
      const context = this.contextFactory.create(extension);

      // Call onInit if it exists
      if (module.onInit) {
        await module.onInit(context);
      }
      
      // Call onEnable if it exists
      if (module.onEnable) {
        await module.onEnable(context);
      }
      
      extension.state = 'active';
      this.logger.info(`Extension ${slug} initialized successfully`);
      
    } catch (error) {
      extension.state = 'error';
      extension.error = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to initialize extension ${slug}:`, error);
      throw error;
    }
  }

  /**
   * Enable an extension (load and activate it)
   */
  public async enableExtension(slug: string): Promise<void> {
    const extension = this.extensions.get(slug);
    
    if (!extension) {
      throw new Error(`Core extension not found: ${slug}`);
    }
    
    // Update state
    await this.stateStore.updateExtensionState(slug, { enabled: true });

    // Initialize if not already
    if (extension.state !== 'active') {
      await this.initializeExtension(slug);
    }
  }

  /**
   * Disable an extension
   */
  public async disableExtension(slug: string): Promise<void> {
    const extension = this.extensions.get(slug);
    
    if (!extension) {
      throw new Error(`Core extension not found: ${slug}`);
    }
    
    try {
      // Call onDisable if it exists
      if (extension.module?.onDisable) {
        const context = this.contextFactory.create(extension);
        await extension.module.onDisable(context);
      }

      extension.state = 'disabled';
      this.registeredApiRoutes.delete(slug);

      // Update state
      await this.stateStore.updateExtensionState(slug, { enabled: false });
      
      this.logger.info(`Extension ${slug} disabled`);
      
    } catch (error) {
      this.logger.error(`Failed to disable extension ${slug}:`, error);
      throw error;
    }
  }

  /**
   * Get all discovered extensions
   */
  public getExtensions(): LoadedCoreExtension[] {
    return Array.from(this.extensions.values());
  }

  /**
   * Get a specific extension
   */
  public getExtension(slug: string): LoadedCoreExtension | undefined {
    return this.extensions.get(slug);
  }

  /**
   * Check if an extension is active
   */
  public isExtensionActive(slug: string): boolean {
    const extension = this.extensions.get(slug);
    return extension?.state === 'active';
  }

  /**
   * Get all registered capabilities
   */
  public getCapabilities(): string[] {
    return Array.from(this.capabilities);
  }

  /**
   * Check if a capability is registered
   */
  public hasCapability(capability: string): boolean {
    return this.capabilities.has(capability);
  }

  /**
   * Get all registered API route factories from active extensions
   * Returns a map of route key to router factory function
   */
  public getRegisteredApiRoutes(): Map<string, any> {
    return new Map(this.registeredApiRoutes);
  }

  /**
   * Get all registered admin slots from active extensions
   * Returns a map of slot name to array of registered components with metadata
   */
  public getRegisteredAdminSlots(): Map<string, Array<{ slot: string; component: any; priority: number; extensionSlug: string }>> {
    return new Map(this.registeredAdminSlots);
  }

  /**
   * Get registered components for a specific admin slot, sorted by priority (highest first)
   */
  public getAdminSlotComponents(slotName: string): Array<{ component: any; priority: number; extensionSlug: string }> {
    const slots = this.registeredAdminSlots.get(slotName) || [];
    return slots
      .map(({ component, priority, extensionSlug }) => ({ component, priority, extensionSlug }))
      .sort((a, b) => b.priority - a.priority); // Higher priority first
  }

  /**
   * Get an active extension's exported module
   * Returns null if extension is not found or not active
   */
  getExtensionModule(slug: string): any {
    const ext = this.extensions.get(slug);
    if (!ext || ext.state !== 'active') {
      return null;
    }
    return ext.module;
  }

  /**
   * Get all active extensions
   */
  getActiveExtensions(): LoadedCoreExtension[] {
    return Array.from(this.extensions.values()).filter((ext) => ext.state === 'active');
  }
}
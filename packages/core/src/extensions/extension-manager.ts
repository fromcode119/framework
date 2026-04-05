import { Logger } from '../logging';
import { SystemConstants } from '../constants';
import { IDatabaseManager } from '@fromcode119/database';
import * as path from 'path';
import * as fs from 'fs';
import { CapabilityRegistry } from '../capabilities';
import {
  CoreExtensionManifest,
  LoadedCoreExtension,
  CoreExtensionModule,
  CoreExtensionContext,
  CoreExtensionState,
} from './types';

/**
 * CoreExtensionManager
 * 
 * Manages optional core packages (core extensions) that can be enabled/disabled
 * at runtime. Similar to PluginManager but for packages in packages/ directory.
 */
export class CoreExtensionManager {
  private extensions: Map<string, LoadedCoreExtension> = new Map();
  private extensionStates: Map<string, CoreExtensionState> = new Map();
  private logger: Logger;
  private db: IDatabaseManager;
  private packagesRoot: string;
  private capabilities: Set<string> = new Set();
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
      await this.loadStates();
      
      // Verify packages directory exists, if not try to fix it
      if (!fs.existsSync(this.packagesRoot)) {
        this.logger.warn(`Packages directory not found at ${this.packagesRoot}, attempting to locate...`);
        // Re-import ProjectPaths to get fresh path resolution
        const { ProjectPaths } = await import('../config/paths');
        this.packagesRoot = ProjectPaths.getPackagesDir();
        this.logger.info(`Using packages directory: ${this.packagesRoot}`);
      }
      
      // Scan packages directory for manifest.json files
      const packageDirs = fs.readdirSync(this.packagesRoot, { withFileTypes: true });
      
      for (const dir of packageDirs) {
        if (!dir.isDirectory()) continue;
        
        const manifestPath = path.join(this.packagesRoot, dir.name, 'manifest.json');
        
        if (!fs.existsSync(manifestPath)) continue;
        
        try {
          const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
          const manifest: CoreExtensionManifest = JSON.parse(manifestContent);
          
          // Only process core extensions (skip plugins, themes, etc.)
          if (manifest.type !== 'core-extension') continue;
          
          const extension: LoadedCoreExtension = {
            manifest,
            path: path.join(this.packagesRoot, dir.name),
            state: 'discovered',
          };
          
          this.extensions.set(manifest.slug, extension);
          this.logger.info(`Discovered core extension: ${manifest.slug}`);
          
        } catch (error) {
          this.logger.error(`Failed to load manifest for ${dir.name}:`, error);
        }
      }
      
      this.logger.info(`Discovered ${this.extensions.size} core extensions`);
      
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
      const state = this.extensionStates.get(slug);
      const isEnabled = state?.enabled ?? this.isEnabledByDefault(slug);
      
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
      const context = this.createExtensionContext(extension);
      
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
    await this.updateExtensionState(slug, { enabled: true });
    
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
        const context = this.createExtensionContext(extension);
        await extension.module.onDisable(context);
      }
      
      extension.state = 'disabled';
      
      // Update state
      await this.updateExtensionState(slug, { enabled: false });
      
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
   * Create extension context with framework services
   */
  private createExtensionContext(extension: LoadedCoreExtension): CoreExtensionContext {
    const logger = this.logger.child(extension.manifest.slug);
    const extensionCapabilities: string[] = [];
    
    return {
      extension,
      services: {
        logger,
        db: this.db,
        integrations: this.services.integrations,
        hooks: this.services.hooks,
        plugins: this.services.plugins,
      },
      registerCapability: (capability: string) => {
        this.capabilities.add(capability);
        extensionCapabilities.push(capability);
        // Also register in global capability registry
        CapabilityRegistry.getInstance().register(capability, {
          provider: extension.manifest.slug,
          version: extension.manifest.version,
          description: extension.manifest.description,
        });
        logger.info(`Registered capability: ${capability}`);
      },
      unregisterCapability: (capability: string) => {
        this.capabilities.delete(capability);
        const index = extensionCapabilities.indexOf(capability);
        if (index > -1) {
          extensionCapabilities.splice(index, 1);
        }
        // Also unregister from global capability registry
        CapabilityRegistry.getInstance().unregister(capability);
        logger.info(`Unregistered capability: ${capability}`);
      },
      getRegisteredCapabilities: () => [...extensionCapabilities],
      registerAdminSlot: (slot: string, component: any, priority: number = 10) => {
        if (!this.registeredAdminSlots.has(slot)) {
          this.registeredAdminSlots.set(slot, []);
        }
        this.registeredAdminSlots.get(slot)!.push({
          slot,
          component,
          priority,
          extensionSlug: extension.manifest.slug,
        });
        logger.info(`Registered admin slot '${slot}' with priority ${priority} for extension: ${extension.manifest.slug}`);
      },
    };
  }

  /**
   * Load extension states from database
   */
  private async loadStates(): Promise<void> {
    try {
      const rows = await this.db.find(
        SystemConstants.TABLE.META,
        { where: { group: 'core-extension-state' } }
      );
      
      for (const row of rows) {
        try {
          const state: CoreExtensionState = JSON.parse(row.value);
          this.extensionStates.set(state.slug, state);
        } catch (error) {
          this.logger.error(`Failed to parse state for ${row.key}:`, error);
        }
      }
      
    } catch (error) {
      // Table might not exist yet, that's okay
      this.logger.warn('Could not load extension states:', error);
    }
  }

  /**
   * Update extension state in database
   */
  private async updateExtensionState(
    slug: string,
    updates: Partial<CoreExtensionState>
  ): Promise<void> {
    const currentState = this.extensionStates.get(slug) || {
      slug,
      enabled: false,
    };
    
    const newState: CoreExtensionState = {
      ...currentState,
      ...updates,
      updatedAt: new Date(),
    };
    
    this.extensionStates.set(slug, newState);
    
    try {
      await this.db.upsert(
        SystemConstants.TABLE.META,
        {
          group: 'core-extension-state',
          key: `extension.${slug}`,
          value: JSON.stringify(newState),
        },
        {
          target: ['group', 'key'],
          set: {
            value: JSON.stringify(newState),
          },
        }
      );
    } catch (error) {
      this.logger.error(`Failed to save state for ${slug}:`, error);
      throw error;
    }
  }

  /**
   * Check if extension should be enabled by default
   */
  private isEnabledByDefault(slug: string): boolean {
    // Check environment variable first
    const envVar = `${slug.toUpperCase().replace(/-/g, '_')}_ENABLED`;
    const envValue = process.env[envVar];
    
    if (envValue !== undefined) {
      return envValue === 'true' || envValue === '1';
    }
    
    // Default to true for backwards compatibility during migration
    return true;
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
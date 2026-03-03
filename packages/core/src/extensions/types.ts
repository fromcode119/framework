/**
 * Core Extension System Types
 * 
 * Core extensions are optional packages in packages/ directory that can be
 * enabled/disabled at runtime. Similar to plugins but part of the monorepo.
 */

export interface CoreExtensionManifest {
  /** Unique identifier (matches package directory name) */
  slug: string;
  
  /** Display name */
  name: string;
  
  /** Version (matches package.json version) */
  version: string;
  
  /** Type must be 'core-extension' to differentiate from plugins */
  type: 'core-extension';
  
  /** Description */
  description: string;
  
  /** Author */
  author?: string;
  
  /** Entry point for extension initialization */
  main?: string;
  
  /** Custom API route path (if different from slug). Extension routes will be mounted at /api/{apiPath} */
  apiPath?: string;
  
  /** Capabilities this extension requires from the framework */
  capabilities?: string[];
  
  /** Admin panel integration configuration */
  admin?: {
    /** Admin group/category */
    group?: string;
    
    /** Icon name (from icon pack) */
    icon?: string;
    
    /** UI slots this extension registers */
    slots?: Array<{
      slot: string;
      component: string;
      priority?: number;
    }>;
    
    /** Routes to register */
    routes?: Array<{
      path: string;
      component: string;
    }>;
  };
  
  /** Dependencies on other extensions or framework version */
  dependencies?: {
    framework?: string;
    extensions?: Record<string, string>;
  };
}

export interface LoadedCoreExtension {
  /** Extension metadata */
  manifest: CoreExtensionManifest;
  
  /** Absolute path to extension directory */
  path: string;
  
  /** Current state */
  state: 'discovered' | 'loaded' | 'active' | 'disabled' | 'error';
  
  /** Error message if state is 'error' */
  error?: string;
  
  /** Loaded module exports (onInit, onEnable, onDisable functions) */
  module?: CoreExtensionModule;
}

export interface CoreExtensionModule {
  /** Called when extension is first loaded */
  onInit?: (context: CoreExtensionContext) => Promise<void> | void;
  
  /** Called when extension is enabled */
  onEnable?: (context: CoreExtensionContext) => Promise<void> | void;
  
  /** Called when extension is disabled */
  onDisable?: (context: CoreExtensionContext) => Promise<void> | void;
}

export interface CoreExtensionContext {
  /** Extension metadata */
  extension: LoadedCoreExtension;
  
  /** Framework services available to extensions */
  services: {
    /** Logger instance */
    logger: any;
    
    /** Database access */
    db: any;
    
    /** Integration manager for registering integration types */
    integrations: any;
    
    /** Hook manager for events */
    hooks: any;
    
    /** Plugin manager for accessing plugins */
    plugins?: any;
  };
  
  /** Register capabilities this extension provides */
  registerCapability: (capability: string) => void;
  
  /** Unregister a previously registered capability */
  unregisterCapability: (capability: string) => void;
  
  /** Get all capabilities registered by this extension */
  getRegisteredCapabilities: () => string[];
  
  /** Register admin UI components */
  registerAdminSlot?: (slot: string, component: any, priority?: number) => void;
  
  /** Register API routes */
  registerApiRoutes?: (router: any) => void;
}

export interface CoreExtensionState {
  /** Extension slug */
  slug: string;
  
  /** Whether extension is enabled */
  enabled: boolean;
  
  /** Configuration */
  config?: Record<string, any>;
  
  /** Last updated timestamp */
  updatedAt?: Date;
}

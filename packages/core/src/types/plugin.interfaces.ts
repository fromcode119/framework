import { IDatabaseManager, IMediaManager, IEmailManager, ICacheManager } from './managers.interfaces';
import { Collection, PluginSettingsSchema } from './schema.interfaces';
import { PluginManifest, MiddlewareConfig } from './manifests.interfaces';
import { PluginCapability } from './enums.enums';

export interface PluginContext {
  readonly db: IDatabaseManager;
  readonly api: {
    get(path: string, ...handlers: any[]): void;
    post(path: string, ...handlers: any[]): void;
    put(path: string, ...handlers: any[]): void;
    delete(path: string, ...handlers: any[]): void;
    patch(path: string, ...handlers: any[]): void;
    use(path: string, ...handlers: any[]): void;
    registerMiddleware(config: MiddlewareConfig): void;
  };
  readonly hooks: any;
  readonly auth: any;
  readonly logger: {
    info: (message: string) => void;
    warn: (message: string) => void;
    error: (message: string) => void;
  };
  
  readonly integrations: {
    /**
     * Register a new integration type (e.g. 'payment', 'search', 'sms')
     */
    registerType(definition: {
      key: string;
      label: string;
      description?: string;
      defaultProvider: string;
      providers?: any[];
      resolveFromEnv?: () => { provider?: string; config?: Record<string, any> } | null;
    }): void;

    /**
     * Register a new provider for an existing integration type
     */
    registerProvider(typeKey: string, provider: {
      key: string;
      label: string;
      description?: string;
      fields?: any[];
      create: (config: Record<string, any>) => any | Promise<any>;
      normalizeConfig?: (config: Record<string, any>) => Record<string, any>;
    }): void;

    /**
     * Resolve and instantiate an integration by its type key
     */
    get<T = any>(typeKey: string): Promise<T>;
  };

  /**
   * Shortcuts for core integrations
   */
  readonly storage: IMediaManager;
  readonly email: IEmailManager;
  readonly cache: ICacheManager;

  readonly redis: any;
  readonly fetch: (url: string, init?: any) => Promise<any>;
  readonly jobs: {
    worker(processor: (job: any) => Promise<any>, options?: any): void;
    add(name: string, data: any, options?: any): Promise<any>;
  };

  readonly scheduler: {
    /**
     * Register a task with a specific schedule (Cron or Interval)
     */
    register(name: string, schedule: string, handler: (data?: any) => Promise<void>, options?: { type?: 'cron' | 'interval' }): Promise<void>;
    
    /**
     * Run a task immediately
     */
    runNow(name: string): Promise<void>;
    
    /**
     * Schedule a one-time task (conceptually, would likely enqueue a Job)
     */
    schedule(name: string, when: Date | string, data: any): Promise<void>;
  };
  
  readonly plugin: {
    slug: string;
    namespace: string;
    version: string;
    dataDir: string;
    config: Record<string, any>;
  };
  
  readonly plugins: {
    namespace(namespace: string): any;
    has(namespace: string, slug: string): boolean;
    get(namespace: string, slug: string): any;
    isEnabled(slug: string): boolean;
    getAPI(slug: string): any;
    emit(event: string, payload: any): void;
    on(event: string, handler: (payload: any) => void | Promise<void>): void;
  };

  // Content Management
  readonly collections: {
    register(collection: Collection): void;
    extend(targetPlugin: string, targetCollection: string, extensions: Partial<Collection>): void;
  };

  // Plugin Settings
  readonly settings: {
    register(schema: PluginSettingsSchema): void;
    get(): Promise<Record<string, any>>;
    update(values: Record<string, any>): Promise<void>;
  };

  readonly i18n: {
    translate(key: string, params?: Record<string, any>, locale?: string): string;
    t(key: string, params?: Record<string, any>): string;
    registerTranslations(locale: string, translations: Record<string, any>): void;
  };

  /**
   * Shortcut for i18n.t
   */
  readonly t: (key: string, params?: Record<string, any>) => string;

  readonly ui: {
    registerHeadInjection(injection: { tag: string; props: Record<string, any>; content?: string }): void;
  };

  readonly runtime: {
    registerModule(name: string, config: { keys: string[], type: 'icon' | 'lib' }): void;
  };

  readonly users: {
    findAdmins(options?: { limit?: number }): Promise<Array<{ id: any; email: string; roles: string[] }>>;
    findByRole(role: string, options?: { limit?: number }): Promise<Array<{ id: any; email: string; roles: string[] }>>;
    findById(id: any): Promise<{ id: any; email: string; username: string; firstName: string; lastName: string; roles: string[] } | null>;
    findByEmail(email: string): Promise<{ id: any; email: string; username: string; firstName: string; lastName: string; roles: string[] } | null>;
  };

  /**
   * Read-only access to the system meta store.
   * Use instead of querying SystemTable.META directly.
   */
  readonly meta: {
    get(key: string): Promise<string | null>;
  };

  /**
   * Role management helpers.
   * Use instead of querying SystemTable.ROLES directly.
   */
  readonly roles: {
    ensure(slug: string, data: { name: string; description?: string; type?: string; permissions?: any[] }): Promise<void>;
  };
}

export interface FromcodePlugin {
  manifest: PluginManifest;
  onInstall?: (ctx: PluginContext) => Promise<void>;
  onInit?: (ctx: PluginContext) => Promise<void>;
  onEnable?: (ctx: PluginContext) => Promise<void>;
  onDisable?: (ctx: PluginContext) => Promise<void>;
  onUninstall?: (ctx: PluginContext) => Promise<void>;
  
  // Public API exposed to other plugins
  publicAPI?: any;
}

/**
 * Represents an installed plugin at runtime, combining manifest data with system state.
 */
export interface LoadedPlugin extends FromcodePlugin {
  instanceId: string;
  state: 'inactive' | 'loading' | 'active' | 'error';
  path?: string; // Absolute path to the plugin folder
  approvedCapabilities?: string[];
  error?: string; // Error message if state is 'error'
  isSandboxed?: boolean;
  entryPath?: string;
  healthStatus?: 'healthy' | 'warning' | 'error';
  iconUrl?: string; // Resolved absolute URL for the plugin icon
  // Runtime-populated fields from API/management
  config?: Record<string, any>;
  sandbox?: boolean | { memoryLimit?: number; timeout?: number; allowNative?: boolean; enabled?: boolean };
}

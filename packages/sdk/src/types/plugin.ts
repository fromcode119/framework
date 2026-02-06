import { IDatabaseManager, IMediaManager, IEmailManager, ICacheManager } from './managers';
import { Collection, PluginSettingsSchema } from './schema';
import { PluginManifest, MiddlewareConfig } from './manifests';

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
  readonly cache: ICacheManager;
  readonly storage: IMediaManager;
  readonly email: IEmailManager;
  readonly redis: any;
  readonly fetch: (url: string, init?: any) => Promise<any>;
  readonly jobs: {
    enqueue(name: string, data: any, options?: any): Promise<any>;
    worker(processor: (job: any) => Promise<any>, options?: any): void;
    // Namespaced enqueue
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
    version: string;
    dataDir: string;
    config: Record<string, any>;
  };
  
  readonly plugins: {
    isEnabled(slug: string): boolean;
    getAPI(slug: string): any;
    emit(event: string, data: any): void;
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

  t(key: string, params?: Record<string, any>): string;

  readonly ui: {
    registerHeadInjection(injection: { tag: string; props: Record<string, any>; content?: string }): void;
  };

  readonly runtime: {
    registerModule(name: string, config: { keys: string[], type: 'icon' | 'lib' }): void;
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
 * This is primarily used in Admin UI and API responses.
 */
export interface Plugin extends PluginManifest {
  state: 'inactive' | 'loading' | 'active' | 'error';
  healthStatus?: 'healthy' | 'warning' | 'error';
  approvedCapabilities?: string[];
  iconUrl?: string; // Resolved absolute URL for the plugin icon
  error?: string;   // Error message if state is 'error'
  path?: string;    // Local file path
}

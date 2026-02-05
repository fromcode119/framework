/**
 * Core interfaces for Fromcode SDK.
 * These are defined here to avoid circular dependencies between packages.
 */

export interface IDatabaseManager {
  readonly drizzle: any;
  readonly dialect: string;
  execute(query: any): Promise<any>;
  connect(): Promise<void>;
  find(tableOrName: any, options?: any): Promise<any[]>;
  findOne(tableOrName: any, where: any): Promise<any | null>;
  insert(tableOrName: any, data: any): Promise<any>;
  update(tableOrName: any, where: any, data: any): Promise<any>;
  delete(tableOrName: any, where: any): Promise<boolean>;
  count(tableName: string, where?: any): Promise<number>;
}

export interface IMediaManager {
  upload(file: Buffer, filename: string): Promise<{ url: string; path: string; width?: number; height?: number; size: number; mimeType: string }>;
  remove(filepath: string): Promise<void>;
}

export interface IEmailManager {
  send(options: { to: string; subject: string; html: string; from?: string; text?: string }): Promise<any>;
}

export interface ICacheManager {
  get(key: string): Promise<any>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
}

export enum PluginCapability {
  API = 'api',
  DATABASE = 'database',
  DATABASE_READ = 'database:read',
  DATABASE_WRITE = 'database:write',
  FILESYSTEM_READ = 'filesystem:read',
  FILESYSTEM_WRITE = 'filesystem:write',
  NETWORK = 'network',
  PLUGINS = 'plugins:interact',
  HOOKS = 'hooks',
  EMAIL = 'email',
  CACHE = 'cache',
  I18N = 'i18n',
  CONTENT = 'content',
  JOBS = 'jobs',
  SCHEDULER = 'scheduler',
  REDIS_GLOBAL = 'redis:global'
}

export enum MiddlewareStage {
  PRE_AUTH = 'pre_auth',
  POST_AUTH = 'post_auth',
  PRE_ROUTING = 'pre_routing'
}

export interface MiddlewareConfig {
  id: string;
  priority?: number;
  stage: MiddlewareStage;
  handler: (req: any, res: any, next: (err?: any) => void) => void;
}

export interface ThemeManifest {
  slug: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  layouts: {
    name: string;
    label: string;
    description?: string;
  }[];
  slots?: string[]; // Defined slot names this theme provides
  overrides?: { name: string; component: string; priority?: number }[]; // Component overrides
  dependencies?: Record<string, string>; // Plugins required by this theme
  variables?: Record<string, string>;
  variableSchema?: Record<string, {
    label: string;
    type: 'color' | 'text' | 'number' | 'select' | 'font' | 'image';
    description?: string;
    options?: { label: string; value: string }[];
    group?: string;
  }>;
  runtimeModules?: Record<string, string | { keys?: string[], type?: 'icon' | 'lib', url?: string }>;
  ui: {
    entry: string;
    css?: string[];
  };
}

export interface MenuItemManifest {
  label: string;
  path: string;
  icon?: string;
  priority?: number;
  group?: string;
  children?: MenuItemManifest[];
}

export interface PluginManifest {
  // Identity
  slug: string;                    // Unique identifier
  name: string;                    // Human-readable name
  version: string;                 // Semver version
  main?: string;                   // Entry point file (usually index.js)
  
  // Metadata
  description?: string;
  author?: string | { name: string; email?: string; url?: string };
  license?: string;
  homepage?: string;
  repository?: string;
  
  // Dependencies
  dependencies?: Record<string, string>; // pluginSlug -> semver
  peerDependencies?: Record<string, string>;
  
  // Capabilities & Permissions
  capabilities?: (PluginCapability | string)[];
  permissions?: string[];
  
  // Hooks & Extensions
  hooks?: any;
  api?: any;
  database?: any;
  
  // Migration & Installation
  migrations?: string;             // Path to migrations folder
  seeds?: string;                  // Path to seed data

  // Metadata for Admin UI
  admin?: {
    group?: string;
    groupStrategy?: 'dropdown' | 'section' | Record<string, 'dropdown' | 'section'>;
    icon?: string;
    menu?: MenuItemManifest[];
    slots?: { slot: string; component: string; priority?: number }[];
    collections?: Collection[];
    management?: {
      component?: string;
      settings?: {
        name: string;
        label: string;
        type: FieldType | string;
        description?: string;
        defaultValue?: any;
        options?: { label: string; value: any }[];
        placeholder?: string;
      }[];
    };
  };

  // Metadata for Frontend Theme
  theme?: {
    overrides?: { name: string; component: string; priority?: number }[];
    variables?: Record<string, string>;
    settings?: {
      name: string;
      label: string;
      type: FieldType;
      description?: string;
      defaultValue?: any;
    }[];
  };

  // UI build info
  ui?: {
    entry?: string; // e.g., "dist/index.js"
    css?: string[];
    assets?: string[];
    headInjections?: any[];
  };

  // Marketplace / Organization
  category: string;                // Flexible category string
  tags?: string[];
  enabled?: boolean;
  
  // Security
  signature?: string;              // Cryptographic signature
  checksum?: string;

  // Configuration
  config?: Record<string, any>;
  sandbox?: boolean | {
    memoryLimit?: number; // In MB
    timeout?: number;     // In ms
    allowNative?: boolean; // If true, runs in main process (trusted)
  };

  // Runtime Bridge configurations
  runtimeModules?: Record<string, string | { keys?: string[], type?: 'icon' | 'lib', url?: string }>;

  // Entry points
  entryPoint?: string;
  uiEntryPoint?: string;

  // Collections
  collections?: string[]; // Path to collections folder or list of slugs
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

export type FieldType = 
  | 'text' 
  | 'textarea'
  | 'number' 
  | 'boolean' 
  | 'date' 
  | 'datetime'
  | 'select' 
  | 'relationship' 
  | 'richText' 
  | 'upload'
  | 'json'
  | 'array'
  | 'color'
  | 'code';

export interface Field {
  name: string;
  type: FieldType;
  label?: string;
  required?: boolean;
  unique?: boolean;
  defaultValue?: any;
  options?: { label: string; value: any }[]; // For select type
  relationTo?: string; // For relationship/upload type
  hasMany?: boolean; // For relationship
  min?: number; // For number
  max?: number; // For number
  minLength?: number; // For text
  maxLength?: number; // For text
  language?: 'javascript' | 'css' | 'html' | 'json' | 'typescript'; // For code
  showTime?: boolean; // For date/datetime
  admin?: {
    hidden?: boolean;
    readOnly?: boolean;
    description?: string;
    position?: 'sidebar' | 'main';
    component?: string;
    width?: 'full' | 'half';
    condition?: {
      field: string;
      operator: 'equals' | 'notEquals' | 'contains' | 'notContains' | 'greaterThan' | 'lessThan' | 'exists' | 'notExists';
      value?: any;
    };
    tab?: string;
    section?: string;
  };
}

export interface SettingsTab {
  id: string;
  label: string;
  icon?: string;
  fields: string[]; // Field names
}

export interface PluginSettingsSchema {
  fields: Field[];
  tabs?: SettingsTab[];
  
  // Optional validation function
  validate?: (
    values: Record<string, any>,
    context: any // Use any to avoid circular dependency
  ) => Promise<Record<string, string> | null>;
  
  // Optional save hook
  onSave?: (
    oldValues: Record<string, any>,
    newValues: Record<string, any>,
    context: any // Use any to avoid circular dependency
  ) => Promise<void>;
}

export type Access = (args: { req: any; user: any }) => boolean | Promise<boolean> | Record<string, any>;

export interface Collection {
  slug: string;
  pluginSlug?: string; // Automatically populated by framework
  shortSlug?: string;  // Automatically populated by framework
  unprefixedSlug?: string; // Automatically populated by framework (the original plugin-provided slug)
  name?: string;
  tableName?: string; // Optional: specify a different table name
  primaryKey?: string; // Optional: default is 'id'
  timestamps?: boolean; // Optional: default is true
  versions?: boolean;   // Optional: enable versioning
  workflow?: boolean;   // Optional: enable draft/review/publish workflow
  priority?: number;    // Optional: for sorting in the menu
  system?: boolean;      // Optional: mark as system collection
  fields: Field[];
  access?: {
    create?: Access;
    read?: Access;
    update?: Access;
    delete?: Access;
  };
  hooks?: {
    beforeChange?: any[];
    afterChange?: any[];
    beforeDelete?: any[];
    afterDelete?: any[];
  };
  admin?: {
    useAsTitle?: string;
    defaultColumns?: string[];
    group?: string;
    icon?: string;
    hidden?: boolean | ((args: { user: any }) => boolean);
    tabs?: {
      name: string;
      label: string;
      icon?: string;
    }[];
    sections?: {
      name: string;
      label: string;
      description?: string;
    }[];
  };
}

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

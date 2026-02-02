import { IDatabaseManager } from '@fromcode/database';
export type { IDatabaseManager };
import { MediaManager } from '@fromcode/media';
import { EmailManager } from '@fromcode/email';
import { CacheManager } from '@fromcode/cache';

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
  REDIS_GLOBAL = 'redis:global'
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
  dependencies?: Record<string, string>; // Plugins required by this theme
  variables?: Record<string, string>;
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
        type: FieldType;
        description?: string;
        defaultValue?: any;
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

  // Runtime Bridge configurations
  runtimeModules?: Record<string, string | { keys?: string[], type?: 'icon' | 'lib', url?: string }>;

  // Entry points
  entryPoint?: string;
  uiEntryPoint?: string;

  // Collections
  collections?: string[]; // Path to collections folder or list of slugs
}

export type FieldType = 
  | 'text' 
  | 'textarea'
  | 'number' 
  | 'boolean' 
  | 'date' 
  | 'select' 
  | 'relationship' 
  | 'richText' 
  | 'upload'
  | 'json';

export interface Field {
  name: string;
  type: FieldType;
  label?: string;
  required?: boolean;
  unique?: boolean;
  defaultValue?: any;
  options?: { label: string; value: any }[]; // For select type
  relationTo?: string; // For relationship/upload type
  admin?: {
    hidden?: boolean;
    readOnly?: boolean;
    description?: string;
    position?: 'sidebar' | 'main';
    component?: string;
  };
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
  priority?: number;    // Optional: for sorting in the menu
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
  };
}

export interface PluginContext {
  readonly db: IDatabaseManager;
  readonly api: any;
  readonly hooks: any;
  readonly auth: any;
  readonly logger: {
    info: (message: string) => void;
    warn: (message: string) => void;
    error: (message: string) => void;
  };
  readonly cache: CacheManager;
  readonly storage: MediaManager;
  readonly email: EmailManager;
  readonly redis: any;
  readonly jobs: {
    enqueue(name: string, data: any, options?: any): Promise<any>;
    worker(processor: (job: any) => Promise<any>, options?: any): void;
    // Namespaced enqueue
    add(name: string, data: any, options?: any): Promise<any>;
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

export interface LoadedPlugin extends FromcodePlugin {
  instanceId: string;
  state: 'inactive' | 'loading' | 'active' | 'error';
  path?: string; // Absolute path to the plugin folder
  approvedCapabilities?: string[];
  error?: string; // Error message if state is 'error'
}

export interface SystemMigration {
  version: number;
  name: string;
  up: (db: IDatabaseManager, sql: any) => Promise<void>;
  down?: (db: IDatabaseManager, sql: any) => Promise<void>;
}

export interface I18nConfig {
  defaultLocale: string;
  locales: string[];
}

export interface TranslationMap {
  [key: string]: string | TranslationMap;
}

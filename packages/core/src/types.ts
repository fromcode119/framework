import { 
  IDatabaseManager, 
  IMediaManager, 
  IEmailManager, 
  ICacheManager,
  PluginCapability,
  ThemeManifest,
  MenuItemManifest,
  PluginManifest,
  FieldType,
  Field,
  Access,
  Collection,
  PluginContext,
  FromcodePlugin,
  MiddlewareStage,
  MiddlewareConfig,
  MarketplacePlugin,
  PluginEntry,
  MarketplaceTheme,
  MarketplaceData
} from '@fromcode/sdk';

export { 
  IDatabaseManager, 
  IMediaManager, 
  IEmailManager, 
  ICacheManager,
  PluginCapability,
  ThemeManifest,
  MenuItemManifest,
  PluginManifest,
  FieldType,
  Field,
  Access,
  Collection,
  PluginContext,
  FromcodePlugin,
  MiddlewareStage,
  MiddlewareConfig,
  MarketplacePlugin,
  PluginEntry,
  MarketplaceTheme,
  MarketplaceData
};

// Aliases for compatibility
export type MediaManager = IMediaManager;
export type EmailManager = IEmailManager;
export type CacheManager = ICacheManager;

export interface LoadedPlugin extends FromcodePlugin {
  instanceId: string;
  state: 'inactive' | 'loading' | 'active' | 'error';
  path?: string; // Absolute path to the plugin folder
  approvedCapabilities?: string[];
  error?: string; // Error message if state is 'error'
  isSandboxed?: boolean;
  entryPath?: string;
  healthStatus?: 'healthy' | 'warning' | 'error';
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

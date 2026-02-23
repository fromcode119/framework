import type { IDatabaseManager } from '@fromcode/sdk';

export { 
  IDatabaseManager, 
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
  LoadedPlugin,
  MiddlewareStage,
  MiddlewareConfig,
  MarketplacePlugin,
  PluginEntry,
  MarketplaceTheme,
  MarketplaceData,
  CollectionQueryInterface,
  CandidateLookupOptions,
  UpsertByCandidatesOptions
} from '@fromcode/sdk';

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

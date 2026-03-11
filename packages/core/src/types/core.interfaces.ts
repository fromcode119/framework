import type { IDatabaseManager } from './managers.interfaces';

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

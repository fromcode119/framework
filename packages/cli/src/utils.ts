import fs from 'fs-extra';
import * as readline from 'readline';
import { DatabaseConnectionUrls, DatabaseFactory, DatabaseManager } from '@fromcode119/database';
import { ProjectPaths, DiscoveryService, MarketplaceCatalogService } from '@fromcode119/core';
import { MarketplaceClient } from '@fromcode119/marketplace-client';

export class CliUtils {
  private static readonly translations = {
  en: {
    'cli.status.checking': 'Checking marketplace at {{registry}}...',
    'cli.status.no_core': 'Marketplace does not provide core version information yet.',
    'cli.status.new_version': '\nA newer version of Fromcode Atlantis is available: {{version}}',
    'cli.status.update_hint': 'Use "atlantis core update" to apply the update.',
    'cli.status.latest': '\nYou are running the latest version of Fromcode Atlantis.',
    'cli.build.starting': '\nBuilding {{type}} {{slug}}...',
    'cli.pack.starting': '\nPacking {{slug}} v{{version}}...',
    'cli.pack.success': '\nPacked successfully!',
    'cli.install.fetching': '\nFetching {{type}} info for {{slug}}...',
    'cli.install.downloading': 'Downloading {{slug}} v{{version}}...',
    'cli.install.extracting': 'Extracting to {{dir}}...',
    'cli.install.success': '\n{{type}} {{slug}} installed successfully!',
  },
};
  private static readonly currentLocale = 'en';

  static getProjectRoot(): string {
    return ProjectPaths.getProjectRoot();
  }

  static getPluginsDir(): string {
    const dir = ProjectPaths.getPluginsDir();
    if (!fs.existsSync(dir)) fs.ensureDirSync(dir);
    return dir;
  }

  static getThemesDir(): string {
    const dir = ProjectPaths.getThemesDir();
    if (!fs.existsSync(dir)) fs.ensureDirSync(dir);
    return dir;
  }

  static async ask(question: string): Promise<string> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer);
      });
    });
  }

  static async getDatabase(): Promise<DatabaseManager> {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not defined. Please check your .env file.');
    const db = DatabaseFactory.create(url);
    await db.connect();
    return db;
  }

  /**
   * The connection DDL runs on — migrations and rollbacks.
   *
   * `DATABASE_URL` is the REQUEST path, which on a tenant-isolated deployment is deliberately a
   * non-owner role with no CREATE on the schema: `db migrate` connected as that role and could only
   * ever fail with "permission denied for schema public" wherever the two roles are actually
   * separated. `DatabaseConnectionUrls.migration()` falls back to `DATABASE_URL`, so a single-role
   * install behaves exactly as before.
   */
  static async getSchemaDatabase(): Promise<DatabaseManager> {
    const url = DatabaseConnectionUrls.migration();
    if (!url) throw new Error('DATABASE_URL is not defined. Please check your .env file.');
    const db = DatabaseFactory.create(url);
    await db.connect();
    return db;
  }

  static getMarketplace(): MarketplaceCatalogService {
    const pluginsDir = CliUtils.getPluginsDir();
    const root = CliUtils.getProjectRoot();
    const discovery = new DiscoveryService(pluginsDir, root);
    return new MarketplaceCatalogService(discovery);
  }

  static getMarketplaceClient(): MarketplaceClient {
    return new MarketplaceClient();
  }

  static t(key: string, params: Record<string, string> = {}, defaultValue?: string): string {
    let text = CliUtils.translations[CliUtils.currentLocale]?.[key] || defaultValue || key;
    Object.keys(params).forEach((p) => {
      text = text.replace(`{{${p}}}`, params[p]);
    });
    return text;
  }

}
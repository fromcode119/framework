import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { Logger } from '../logging';
import type { SystemMigration } from '../types';

export class PluginMigrationLoader {
  private static readonly logger = new Logger({ namespace: 'plugin-migration-loader' });

  static async load(pluginSlug: string, pluginPath: string, relativeMigrationsPath?: string): Promise<SystemMigration[]> {
    if (!relativeMigrationsPath) {
      return [];
    }

    const migrationsDir = path.resolve(pluginPath, relativeMigrationsPath);
    if (!fs.existsSync(migrationsDir) || !fs.statSync(migrationsDir).isDirectory()) {
      return [];
    }

    const files = fs.readdirSync(migrationsDir)
      .filter((file) => !file.startsWith('.'))
      .filter((file) => !file.startsWith('index.') && !file.endsWith('.d.ts') && !file.endsWith('.map'))
      .filter((file) => file.endsWith('.ts') || file.endsWith('.js'))
      .filter((file) => this.isLoadableFile(migrationsDir, file))
      .sort((left, right) => left.localeCompare(right));

    const migrations: SystemMigration[] = [];
    let fallbackIndex = 0;

    for (const file of files) {
      const absolutePath = path.resolve(migrationsDir, file);
      try {
        const module = await import(pathToFileURL(absolutePath).href);
        const migrationModule = module.default && typeof module.default.up === 'function'
          ? module.default
          : module;

        if (typeof migrationModule?.up !== 'function') {
          this.logger.warn(`Skipping plugin migration without an up() export: ${absolutePath}`);
          continue;
        }

        const basename = file.replace(/\.(ts|js)$/i, '');
        fallbackIndex += 1;
        migrations.push({
          name: `plugin:${pluginSlug}:${basename}`,
          version: this.toVersionNumber(basename, fallbackIndex),
          up: migrationModule.up,
          down: typeof migrationModule.down === 'function' ? migrationModule.down : undefined,
        });
      } catch (error) {
        if (this.shouldSkipImportError(error, absolutePath)) {
          this.logger.warn(`Skipping missing plugin migration module: ${absolutePath}`);
          continue;
        }
        this.logger.error(`Failed to load plugin migration ${absolutePath}: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
      }
    }

    return migrations.sort((left, right) => {
      if (left.version === right.version) {
        return left.name.localeCompare(right.name);
      }
      return left.version - right.version;
    });
  }

  private static toVersionNumber(basename: string, fallbackIndex: number): number {
    const dateMatch = basename.match(/^(\d{4})-(\d{2})-(\d{2})(?:-(\d+))?/);
    if (dateMatch) {
      const [, year, month, day, serial] = dateMatch;
      return Number(`${year}${month}${day}${String(serial || fallbackIndex).padStart(2, '0')}`);
    }

    const digits = basename.replace(/\D/g, '');
    if (digits) {
      return Number(digits.slice(0, 12));
    }

    return 900000000 + fallbackIndex;
  }

  private static isLoadableFile(migrationsDir: string, file: string): boolean {
    const absolutePath = path.resolve(migrationsDir, file);

    try {
      return fs.statSync(absolutePath).isFile();
    } catch (error) {
      this.logger.warn(`Skipping plugin migration entry that is not loadable: ${absolutePath}`);
      return false;
    }
  }

  private static shouldSkipImportError(error: unknown, absolutePath: string): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const message = String(error.message || '');
    if (!message.includes('Cannot find module')) {
      return false;
    }

    const moduleUrl = pathToFileURL(absolutePath).href;
    return message.includes(moduleUrl) || message.includes(absolutePath);
  }
}

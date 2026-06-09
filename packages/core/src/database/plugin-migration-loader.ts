import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { pathToFileURL } from 'url';
import { Logger } from '../logging';
import type { SystemMigration } from '../types';

/**
 * A CommonJS require bound to this module.
 *
 * Plugin migrations are shipped as esbuild `--format=cjs` `.js` files. The loader previously
 * used `await import(fileUrl)`, but the framework compiles with `module: "CommonJS"`, under
 * which tsc rewrites that to `require(fileUrl)` — and `require()` cannot load a `file://` URL,
 * so every migration silently failed to load in production (it only worked under tsx in dev).
 * Loading the CJS module by absolute path with a real require avoids the URL problem entirely.
 */
const migrationRequire = createRequire(__filename);

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
        const imported = migrationRequire(absolutePath);
        const migrationModule = this.resolveMigrationExport(imported);

        if (!migrationModule || typeof migrationModule.up !== 'function') {
          this.logger.warn(`Skipping plugin migration without an up() export: ${absolutePath}`);
          continue;
        }

        const basename = file.replace(/\.(ts|js)$/i, '');
        fallbackIndex += 1;
        migrations.push({
          name: `plugin:${pluginSlug}:${basename}`,
          version: this.toVersionNumber(basename, fallbackIndex),
          up: migrationModule.up.bind(migrationModule),
          down: typeof migrationModule.down === 'function' ? migrationModule.down.bind(migrationModule) : undefined,
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

  /**
   * Resolve the migration object (the one exposing up()/down()) from an imported module.
   *
   * Handles every shape we ship:
   *  - ESM .ts loaded via tsx (dev): `export default new Migration()` → module.default
   *  - CJS .js compiled by esbuild --format=cjs and loaded by Node's import() (prod):
   *    interop wraps module.exports as `default`, so the instance is at module.default.default
   *  - `export default class Migration extends BaseMigration` → the class itself; up() lives on
   *    the prototype, so it must be instantiated
   *  - the module object itself carrying up() (defensive)
   */
  private static resolveMigrationExport(module: any): { up?: unknown; down?: unknown } | undefined {
    const candidates = [module?.default?.default, module?.default, module];
    for (const candidate of candidates) {
      if (!candidate) {
        continue;
      }
      // Already an instance (or object) exposing up().
      if (typeof candidate.up === 'function') {
        return candidate;
      }
      // A migration class whose prototype carries up() — instantiate it.
      if (typeof candidate === 'function' && typeof candidate.prototype?.up === 'function') {
        try {
          return new candidate();
        } catch {
          // Not constructable without args — fall through to the next candidate.
        }
      }
    }
    return undefined;
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

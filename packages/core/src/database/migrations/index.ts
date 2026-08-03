import fs from 'fs';
import path from 'path';
import type { ISystemMigration } from '@core/interfaces/system-migration.interface';

export class MigrationLoader {
  static load(): ISystemMigration[] {
    const migrations: ISystemMigration[] = [];
    const migrationsDir = __dirname;

    if (!fs.existsSync(migrationsDir)) {
      console.warn(`[MigrationLoader] Directory ${migrationsDir} does not exist.`);
      return [];
    }

    const files = fs.readdirSync(migrationsDir);

    for (const file of files) {
      if (
        file.startsWith('index.') ||
        file.endsWith('.d.ts') ||
        file.endsWith('.map') ||
        file.includes('.test.') ||
        file.includes('.spec.') ||
        (!file.endsWith('.ts') && !file.endsWith('.js'))
      ) {
        continue;
      }

      try {
        const filePath = path.join(migrationsDir, file);
        const absolutePath = path.resolve(filePath);
        const module = require(absolutePath);

        const migration = MigrationLoader.resolveMigration(module);

        if (migration) {
          migrations.push(migration);
        }
      } catch (err) {
        console.error(`[MigrationLoader] Failed to load migration from ${file}:`, err);
      }
    }

    return migrations.sort((a, b) => a.version - b.version);
  }

  /**
   * The migration object in an imported module, whatever form it takes.
   *
   * Core migrations used to be required to `export default new Migration()`, which is the one export
   * form the house rules forbid. A NAMED class export is now the written form; it is instantiated here.
   * `default` is still accepted so a stale compiled `dist` or a third-party migration keeps working.
   */
  private static resolveMigration(module: unknown): ISystemMigration | undefined {
    const bag = module as Record<string, unknown> | undefined;
    if (!bag) return undefined;
    const candidates = [(bag.default as Record<string, unknown>)?.default, bag.default, ...Object.values(bag)];
    for (const candidate of candidates) {
      if (!candidate) continue;
      if (typeof (candidate as ISystemMigration).up === 'function') return candidate as ISystemMigration;
      const asClass = candidate as { prototype?: { up?: unknown } };
      if (typeof candidate === 'function' && typeof asClass.prototype?.up === 'function') {
        try {
          return new (candidate as new () => ISystemMigration)();
        } catch {
          // not constructable without arguments — try the next candidate
        }
      }
    }
    return undefined;
  }
}
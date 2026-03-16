import fs from 'fs';
import path from 'path';
import { SystemMigration } from '../../types';

export class MigrationLoader {
  static load(): SystemMigration[] {
    const migrations: SystemMigration[] = [];
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
        (!file.endsWith('.ts') && !file.endsWith('.js'))
      ) {
        continue;
      }

      try {
        const filePath = path.join(migrationsDir, file);
        const absolutePath = path.resolve(filePath);
        const module = require(absolutePath);

        const migration = module.default as SystemMigration | undefined;

        if (migration) {
          migrations.push(migration);
        }
      } catch (err) {
        console.error(`[MigrationLoader] Failed to load migration from ${file}:`, err);
      }
    }

    return migrations.sort((a, b) => a.version - b.version);
  }
}
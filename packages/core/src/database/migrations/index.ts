import fs from 'fs';
import path from 'path';
import { SystemMigration } from '../../types';

export const loadMigrations = (): SystemMigration[] => {
  const migrations: SystemMigration[] = [];
  const migrationsDir = __dirname;
  
  if (!fs.existsSync(migrationsDir)) {
    console.warn(`[MigrationLoader] Directory ${migrationsDir} does not exist.`);
    return [];
  }

  const files = fs.readdirSync(migrationsDir);

  for (const file of files) {
    // Skip index files and non-migration files
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
      // Clean up the path for require - sometimes __dirname doesn't play well with tsx requirements
      const absolutePath = path.resolve(filePath);
      const module = require(absolutePath);
      
      // Find the migration object in the module exports
      const migration = Object.values(module).find(
        (m: any) => m && typeof m === 'object' && typeof m.version === 'number' && typeof m.up === 'function'
      ) as SystemMigration;

      if (migration) {
        migrations.push(migration);
      }
    } catch (err) {
      console.error(`[MigrationLoader] Failed to load migration from ${file}:`, err);
    }
  }

  return migrations.sort((a, b) => a.version - b.version);
};

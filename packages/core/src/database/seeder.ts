import { IDatabaseManager, sql } from '@fromcode119/database';
import { Logger } from '@fromcode119/sdk';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

export class Seeder {
  private logger = new Logger({ namespace: 'seeder' });

  constructor(private db: IDatabaseManager) {}

  async seed(filePath: string) {
    const absolutePath = path.resolve(filePath);
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Seed file not found: ${absolutePath}`);
    }

    this.logger.info(`Running seed from: ${absolutePath}...`);
    
    try {
      let loadedModule: any;
      try {
        // Keep require first for commonjs and ts-node/tsx hook scenarios.
        loadedModule = require(absolutePath);
      } catch (requireErr: any) {
        this.logger.warn(`require() failed for seed file, trying dynamic import: ${requireErr.message}`);
        loadedModule = await import(pathToFileURL(absolutePath).href);
      }

      const seedFunc =
        (typeof loadedModule?.default === 'function' ? loadedModule.default : null) ||
        Object.values(loadedModule || {}).find((f) => typeof f === 'function');

      if (typeof seedFunc === 'function') {
        await (seedFunc as any)(this.db, sql);
        this.logger.info('Seed completed successfully.');
      } else {
        throw new Error('No valid seed function found in file. Expected at least one exported function.');
      }
    } catch (err: any) {
      this.logger.error(`Seed failed: ${err.message}`);
      throw err;
    }
  }
}
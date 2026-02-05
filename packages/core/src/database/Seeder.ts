import { IDatabaseManager, sql } from '@fromcode/database';
import { Logger } from '../logging/logger';
import fs from 'fs';
import path from 'path';

export class Seeder {
  private logger = new Logger({ namespace: 'Seeder' });

  constructor(private db: IDatabaseManager) {}

  async seed(filePath: string) {
    const absolutePath = path.resolve(filePath);
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Seed file not found: ${absolutePath}`);
    }

    this.logger.info(`Running seed from: ${absolutePath}...`);
    
    try {
      // Use dynamic import if available, otherwise require
      // For .ts files in a bundled environment, this is tricky.
      // But in dev, tsx/ts-node usually hooks into require.
      const module = require(absolutePath);
      const seedFunc = Object.values(module).find(f => typeof f === 'function');

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

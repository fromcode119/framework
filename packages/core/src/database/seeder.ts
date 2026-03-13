import { IDatabaseManager, sql } from '@fromcode119/database';
import { Logger } from '../logging';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { SeederCallableResolver } from './seeder-callable-resolver';

export class Seeder {
  private logger = new Logger({ namespace: 'seeder' });
  private resolver = new SeederCallableResolver();

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

      const resolved = this.resolver.resolveCallable(loadedModule);

      await resolved.callable(this.db, sql);
      this.logger.info(`Seed completed successfully using ${resolved.sourceType}:${resolved.symbolName}.`);
    } catch (err: any) {
      const suffix = err?.code ? ` [${err.code}]` : '';
      this.logger.error(`Seed failed${suffix}: ${err.message}`);
      throw err;
    }
  }
}
import type { IDatabaseManager } from '@core/interfaces/database-manager.interface';

export interface ISystemMigration {
  version: number;
  name: string;
  up: (db: IDatabaseManager, sql: any) => Promise<void>;
  down?: (db: IDatabaseManager, sql: any) => Promise<void>;
}

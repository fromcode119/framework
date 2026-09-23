import type { IDatabaseManager } from '@core/interfaces/database-manager.interface';
import type { IMigrationTenantScope } from '@fromcode119/database';

export interface ISystemMigration {
  version: number;
  name: string;
  up: (db: IDatabaseManager, sql: any, tenants: IMigrationTenantScope) => Promise<void>;
  down?: (db: IDatabaseManager, sql: any) => Promise<void>;
}

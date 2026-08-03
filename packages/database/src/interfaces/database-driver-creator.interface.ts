import type { IDatabaseManager } from '@database/interfaces/database-manager.interface';

/** Builds a database manager for a connection string / config (callable contract). */
export interface IDatabaseDriverCreator {
  (connection: any): IDatabaseManager;
}

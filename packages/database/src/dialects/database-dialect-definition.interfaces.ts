import type { IDatabaseManager } from '../types';
import type { DatabaseBackupHandler } from './database-backup.interfaces';
import type { DatabaseDialectResolver } from './database-dialect-resolver.interfaces';

export interface DatabaseDialectDefinition {
  readonly dialect: string;
  readonly protocols: readonly string[];

  createManager(connection: string): IDatabaseManager;

  createResolver(): DatabaseDialectResolver;

  createBackupHandler(): DatabaseBackupHandler | null;
}
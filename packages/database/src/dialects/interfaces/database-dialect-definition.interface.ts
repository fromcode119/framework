import type { IDatabaseManager } from '@database/interfaces/database-manager.interface';
import type { IDatabaseBackupHandler } from '@database/dialects/interfaces/database-backup-handler.interface';
import type { IDatabaseDialectResolver } from '@database/dialects/interfaces/database-dialect-resolver.interface';

export interface IDatabaseDialectDefinition {
  readonly dialect: string;
  readonly protocols: readonly string[];

  createManager(connection: string): IDatabaseManager;

  createResolver(): IDatabaseDialectResolver;

  createBackupHandler(): IDatabaseBackupHandler | null;
}
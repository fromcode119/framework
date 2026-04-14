import type { IDatabaseManager } from '../types';
import type { DatabaseDialectDefinition } from './database-dialect-definition.interfaces';
import type { DatabaseDialectResolver } from './database-dialect-resolver.interfaces';
import { PostgresDialectResolver } from './postgres-dialect-resolver';

export class PostgresDatabaseDialect implements DatabaseDialectDefinition {
  readonly dialect = 'postgres';

  readonly protocols = ['postgres', 'postgresql'] as const;

  createManager(connection: string): IDatabaseManager {
    const { PostgresDatabaseManager } = require('./postgres-database-manager');
    return new PostgresDatabaseManager(connection);
  }

  createResolver(): DatabaseDialectResolver {
    return new PostgresDialectResolver();
  }

  createBackupHandler(): ReturnType<DatabaseDialectDefinition['createBackupHandler']> {
    const { PostgresDatabaseBackupHandler } = require('./postgres-database-backup-handler');
    return new PostgresDatabaseBackupHandler();
  }
}
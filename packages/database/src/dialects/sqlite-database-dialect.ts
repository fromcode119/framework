import type { IDatabaseManager } from '../types';
import type { DatabaseDialectDefinition } from './database-dialect-definition.interfaces';
import type { DatabaseDialectResolver } from './database-dialect-resolver.interfaces';
import { SqliteDialectResolver } from './sqlite-dialect-resolver';

export class SqliteDatabaseDialect implements DatabaseDialectDefinition {
  readonly dialect = 'sqlite';

  readonly protocols = ['sqlite'] as const;

  createManager(connection: string): IDatabaseManager {
    const { SqliteDatabaseManager } = require('./sqlite-database-manager');
    return new SqliteDatabaseManager(connection);
  }

  createResolver(): DatabaseDialectResolver {
    return new SqliteDialectResolver();
  }

  createBackupHandler(): ReturnType<DatabaseDialectDefinition['createBackupHandler']> {
    const { SqliteDatabaseBackupHandler } = require('./sqlite-database-backup-handler');
    return new SqliteDatabaseBackupHandler();
  }
}
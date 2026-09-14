import type { IDatabaseManager } from '@database/interfaces/database-manager.interface';
import type { IDatabaseDialectDefinition } from '@database/dialects/interfaces/database-dialect-definition.interface';
import type { IDatabaseDialectResolver } from '@database/dialects/interfaces/database-dialect-resolver.interface';
import { MysqlDialectResolver } from '@database/dialects/mysql/dialect-resolver';
// Static import: the backup handler pulls only Node built-ins, so there is nothing heavy to defer.
// (The MANAGER stays a lazy require — that one loads the actual driver.)
import { MysqlDatabaseBackupHandler } from '@database/dialects/mysql/database-backup-handler';

export class MysqlDatabaseDialect implements IDatabaseDialectDefinition {
  readonly dialect = 'mysql';

  readonly protocols = ['mysql'] as const;

  createManager(connection: string): IDatabaseManager {
    const { MysqlDatabaseManager } = require('@database/dialects/mysql/database-manager');
    return new MysqlDatabaseManager(connection);
  }

  createResolver(): IDatabaseDialectResolver {
    return new MysqlDialectResolver();
  }

  createBackupHandler(): ReturnType<IDatabaseDialectDefinition['createBackupHandler']> {
    return new MysqlDatabaseBackupHandler();
  }
}
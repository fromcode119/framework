import type { IDatabaseManager } from '../types';
import type { DatabaseDialectDefinition } from './database-dialect-definition.interfaces';
import type { DatabaseDialectResolver } from './database-dialect-resolver.interfaces';
import { MysqlDialectResolver } from './mysql-dialect-resolver';

export class MysqlDatabaseDialect implements DatabaseDialectDefinition {
  readonly dialect = 'mysql';

  readonly protocols = ['mysql'] as const;

  createManager(connection: string): IDatabaseManager {
    const { MysqlDatabaseManager } = require('./mysql-database-manager');
    return new MysqlDatabaseManager(connection);
  }

  createResolver(): DatabaseDialectResolver {
    return new MysqlDialectResolver();
  }

  createBackupHandler(): ReturnType<DatabaseDialectDefinition['createBackupHandler']> {
    return null;
  }
}
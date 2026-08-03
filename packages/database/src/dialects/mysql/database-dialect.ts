import type { IDatabaseManager } from '@database/interfaces/database-manager.interface';
import type { IDatabaseDialectDefinition } from '@database/dialects/interfaces/database-dialect-definition.interface';
import type { IDatabaseDialectResolver } from '@database/dialects/interfaces/database-dialect-resolver.interface';
import { MysqlDialectResolver } from '@database/dialects/mysql/dialect-resolver';

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
    return null;
  }
}
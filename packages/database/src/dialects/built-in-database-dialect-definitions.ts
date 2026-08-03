import type { IDatabaseDialectDefinition } from '@database/dialects/interfaces/database-dialect-definition.interface';
import { MysqlDatabaseDialect } from '@database/dialects/mysql/database-dialect';
import { PostgresDatabaseDialect } from '@database/dialects/postgres/database-dialect';
import { SqliteDatabaseDialect } from '@database/dialects/sqlite/database-dialect';

export class BuiltInDatabaseDialectDefinitions {
  static load(): IDatabaseDialectDefinition[] {
    return [
      new SqliteDatabaseDialect(),
      new PostgresDatabaseDialect(),
      new MysqlDatabaseDialect(),
    ];
  }
}
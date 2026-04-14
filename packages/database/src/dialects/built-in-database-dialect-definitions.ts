import type { DatabaseDialectDefinition } from './database-dialect-definition.interfaces';
import { MysqlDatabaseDialect } from './mysql-database-dialect';
import { PostgresDatabaseDialect } from './postgres-database-dialect';
import { SqliteDatabaseDialect } from './sqlite-database-dialect';

export class BuiltInDatabaseDialectDefinitions {
  static load(): DatabaseDialectDefinition[] {
    return [
      new SqliteDatabaseDialect(),
      new PostgresDatabaseDialect(),
      new MysqlDatabaseDialect(),
    ];
  }
}
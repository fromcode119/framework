import type { IDatabaseManager } from '@database/interfaces/database-manager.interface';
import type { IDatabaseDialectDefinition } from '@database/dialects/interfaces/database-dialect-definition.interface';
import type { IDatabaseDialectResolver } from '@database/dialects/interfaces/database-dialect-resolver.interface';
import { SqliteDialectResolver } from '@database/dialects/sqlite/dialect-resolver';
// Static import: the backup handler pulls only Node built-ins, so there is nothing heavy to defer.
// (The MANAGER stays a lazy require — that one loads the actual driver.) A bare `require()` of a
// relative TS path is also unresolvable under the ESM test runner, which left this path untested.
import { SqliteDatabaseBackupHandler } from '@database/dialects/sqlite/database-backup-handler';

export class SqliteDatabaseDialect implements IDatabaseDialectDefinition {
  readonly dialect = 'sqlite';

  readonly protocols = ['sqlite'] as const;

  createManager(connection: string): IDatabaseManager {
    const { SqliteDatabaseManager } = require('@database/dialects/sqlite/database-manager');
    return new SqliteDatabaseManager(connection);
  }

  createResolver(): IDatabaseDialectResolver {
    return new SqliteDialectResolver();
  }

  createBackupHandler(): ReturnType<IDatabaseDialectDefinition['createBackupHandler']> {
    return new SqliteDatabaseBackupHandler();
  }
}
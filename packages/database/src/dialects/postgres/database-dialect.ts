import type { IDatabaseManager } from '@database/interfaces/database-manager.interface';
import type { IDatabaseDialectDefinition } from '@database/dialects/interfaces/database-dialect-definition.interface';
import type { IDatabaseDialectResolver } from '@database/dialects/interfaces/database-dialect-resolver.interface';
import { PostgresDialectResolver } from '@database/dialects/postgres/dialect-resolver';
// Static import: the backup handler pulls only Node built-ins, so there is nothing heavy to defer.
// (The MANAGER stays a lazy require — that one loads the actual driver.) A bare `require()` of a
// relative TS path is also unresolvable under the ESM test runner, which left this path untested.
import { PostgresDatabaseBackupHandler } from '@database/dialects/postgres/database-backup-handler';

export class PostgresDatabaseDialect implements IDatabaseDialectDefinition {
  readonly dialect = 'postgres';

  readonly protocols = ['postgres', 'postgresql'] as const;

  createManager(connection: string): IDatabaseManager {
    const { PostgresDatabaseManager } = require('@database/dialects/postgres/database-manager');
    return new PostgresDatabaseManager(connection);
  }

  createResolver(): IDatabaseDialectResolver {
    return new PostgresDialectResolver();
  }

  createBackupHandler(): ReturnType<IDatabaseDialectDefinition['createBackupHandler']> {
    return new PostgresDatabaseBackupHandler();
  }
}
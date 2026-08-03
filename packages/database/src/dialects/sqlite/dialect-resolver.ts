import type { IDatabaseDialectResolver } from '@database/dialects/interfaces/database-dialect-resolver.interface';

export class SqliteDialectResolver implements IDatabaseDialectResolver {
  readonly dialect = 'sqlite';

  matches(connection: string): boolean {
    const normalizedConnection = String(connection || '').trim();
    return normalizedConnection.startsWith('file:')
      || normalizedConnection.endsWith('.db')
      || normalizedConnection === ':memory:'
      || normalizedConnection.startsWith('sqlite:');
  }
}
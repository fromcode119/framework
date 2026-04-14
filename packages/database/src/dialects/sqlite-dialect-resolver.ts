import type { DatabaseDialectResolver } from './database-dialect-resolver.interfaces';

export class SqliteDialectResolver implements DatabaseDialectResolver {
  readonly dialect = 'sqlite';

  matches(connection: string): boolean {
    const normalizedConnection = String(connection || '').trim();
    return normalizedConnection.startsWith('file:')
      || normalizedConnection.endsWith('.db')
      || normalizedConnection === ':memory:'
      || normalizedConnection.startsWith('sqlite:');
  }
}
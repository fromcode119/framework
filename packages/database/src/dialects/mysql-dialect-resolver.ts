import type { DatabaseDialectResolver } from './database-dialect-resolver.interfaces';

export class MysqlDialectResolver implements DatabaseDialectResolver {
  readonly dialect = 'mysql';

  matches(connection: string): boolean {
    return this.readProtocol(connection) === 'mysql';
  }

  private readProtocol(connection: string): string {
    const normalizedConnection = String(connection || '').trim();
    if (!normalizedConnection.includes('://')) {
      return '';
    }

    try {
      return new URL(normalizedConnection).protocol.replace(':', '');
    } catch {
      return '';
    }
  }
}
import type { IDatabaseDialectResolver } from '@database/dialects/interfaces/database-dialect-resolver.interface';

export class PostgresDialectResolver implements IDatabaseDialectResolver {
  readonly dialect = 'postgres';

  matches(connection: string): boolean {
    const protocol = this.readProtocol(connection);
    return protocol === 'postgres' || protocol === 'postgresql';
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
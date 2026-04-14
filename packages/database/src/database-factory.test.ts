import { describe, expect, it } from 'vitest';
import { DatabaseFactory } from './database-factory';

describe('DatabaseFactory', () => {
  it('resolves sqlite dialect through the dialect registry', () => {
    expect(DatabaseFactory.resolveDialect('file:./data/app.db')).toBe('sqlite');
  });

  it('creates a backup handler from the resolved dialect definition', () => {
    expect(DatabaseFactory.createBackupHandler('file:./data/app.db')?.dialect).toBe('sqlite');
  });

  it('normalizes postgresql connections to postgres through the dialect registry', () => {
    expect(DatabaseFactory.resolveDialect('postgresql://user:pass@localhost:5432/app')).toBe('postgres');
  });

  it('allows custom dialect resolvers to be registered without editing the factory', () => {
    DatabaseFactory.registerDialectResolver({
      dialect: 'memory',
      matches(connection: string): boolean {
        return String(connection || '').trim().startsWith('memory://');
      },
    });

    expect(DatabaseFactory.resolveDialect('memory://cache')).toBe('memory');
  });
});
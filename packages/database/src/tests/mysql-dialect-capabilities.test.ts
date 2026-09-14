import { describe, expect, it } from 'vitest';
import { MysqlDatabaseDialect } from '@database/dialects/mysql/database-dialect';
import { MysqlDatabaseManager } from '@database/dialects/mysql/database-manager';
import { PostgresDatabaseDialect } from '@database/dialects/postgres/database-dialect';
import { SqliteDatabaseDialect } from '@database/dialects/sqlite/database-dialect';

/**
 * What the MySQL dialect can do, asked of the dialect rather than of a comment.
 *
 * `createBackupHandler()` returned null here for as long as the driver existed, and that single null
 * was the difference between "a driver we ship" and "a driver an operator can be offered" — a
 * platform that cannot take a backup of a database has no business inviting anyone to put their data
 * in it. The wizard reads exactly this capability, so the test guards the promise the UI makes.
 */
describe('the MySQL dialect', () => {
  it('can take a backup, like the other two', () => {
    expect(new MysqlDatabaseDialect().createBackupHandler()).not.toBeNull();
    expect(new PostgresDatabaseDialect().createBackupHandler()).not.toBeNull();
    expect(new SqliteDatabaseDialect().createBackupHandler()).not.toBeNull();
  });

  it('reports the dialect its handler is for, so the registry can resolve it', () => {
    expect(new MysqlDatabaseDialect().createBackupHandler()?.dialect).toBe('mysql');
  });

  /**
   * Tenancy is one database with rows tagged `tenant_id`, isolated by PostgreSQL row-level security.
   * MySQL has no equivalent, so this must stay false — `TenantMode` refuses to boot a second tenant
   * on it, and that refusal is the only thing standing between a MySQL deployment and serving every
   * tenant's rows to every other tenant.
   */
  it('does NOT claim tenant isolation it does not have', () => {
    // Asked of the prototype: the method reads no instance state, so it needs no connection.
    expect((MysqlDatabaseManager as any).prototype.supportsTenantIsolation.call({})).toBe(false);
  });
});

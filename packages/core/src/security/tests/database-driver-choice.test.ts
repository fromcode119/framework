import { describe, expect, it } from 'vitest';
// Reached through the database package's own source alias rather than its barrel: the dialect
// managers are deliberately not public API, and this test exists precisely to compare the wizard's
// claims against the implementations, which means it has to see them.
import { MysqlDatabaseManager } from '@database/dialects/mysql/database-manager';
import { PostgresDatabaseManager } from '@database/dialects/postgres/database-manager';
import { SqliteDatabaseManager } from '@database/dialects/sqlite/database-manager';
import { DatabaseDriverChoice } from '@core/security/enums/database-driver-choice.enum';

/**
 * The wizard's driver list states a capability the DIALECTS actually own, so the danger is not that
 * a flag is wrong today — it is that a driver gains row-level security later and this list keeps
 * telling people it has none, or worse, loses it and keeps saying it has some.
 *
 * `supportsTenantIsolation()` reads no instance state on any dialect, so it can be asked of the
 * prototype without a connection. That is the whole point of this test: it compares the two sources
 * rather than restating one of them.
 */
describe('DatabaseDriverChoice', () => {
  const isolationOf = (manager: { prototype: { supportsTenantIsolation(): boolean } }): boolean =>
    manager.prototype.supportsTenantIsolation.call({});

  it.each([
    ['postgres', DatabaseDriverChoice.POSTGRES, PostgresDatabaseManager],
    ['sqlite', DatabaseDriverChoice.SQLITE, SqliteDatabaseManager],
    ['mysql', DatabaseDriverChoice.MYSQL, MysqlDatabaseManager],
  ])('says the same thing about %s isolation as the dialect itself', (_label, choice, manager) => {
    expect(choice.isolatesTenants).toBe(isolationOf(manager as any));
  });

  it('treats "cannot isolate" and "single site only" as the same fact, because they are', () => {
    expect(DatabaseDriverChoice.POSTGRES.isSingleSiteOnly).toBe(false);
    expect(DatabaseDriverChoice.SQLITE.isSingleSiteOnly).toBe(true);
    expect(DatabaseDriverChoice.MYSQL.isSingleSiteOnly).toBe(true);
  });

  it('lists every driver, including the one that cannot be chosen', () => {
    expect(DatabaseDriverChoice.ordered.map((driver) => driver.value)).toEqual(['postgres', 'sqlite', 'mysql']);
    expect(DatabaseDriverChoice.ordered.filter((driver) => !driver.isAvailable).map((d) => d.value)).toEqual(['mysql']);
  });

  it('refuses an unknown driver instead of resolving one, because every default here is somebody\'s isolation', () => {
    expect(DatabaseDriverChoice.parse('oracle')).toBeUndefined();
    expect(() => DatabaseDriverChoice.from('oracle')).toThrow(/not a driver this platform ships/);
    expect(() => DatabaseDriverChoice.from('')).toThrow();
  });

  it('parses case-insensitively and round-trips its own instances', () => {
    expect(DatabaseDriverChoice.parse('POSTGRES')).toBe(DatabaseDriverChoice.POSTGRES);
    expect(DatabaseDriverChoice.parse(DatabaseDriverChoice.SQLITE)).toBe(DatabaseDriverChoice.SQLITE);
  });
});

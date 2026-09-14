import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// The MANAGER directly, not through DatabaseFactory: the factory reaches the driver with a lazy
// `require()` of an aliased path, which the ESM test runner cannot resolve — so going through it
// made every case here skip silently, which is worse than having no test at all.
import { MysqlDatabaseManager } from '@database/dialects/mysql/database-manager';
import { sql } from 'drizzle-orm';

/**
 * The MySQL driver against a real MySQL, because none of these bugs could be seen without one.
 *
 * Every failure this guards was silent rather than loud, which is how they survived: `find()`
 * returned the FIRST ROW instead of the rows (so callers got an object where they expected an array),
 * `find()` with no `columns` rendered an empty select list, and `count()` returned 0 for every table.
 * A count of zero raises nothing — it just makes an empty platform out of a full one, and
 * `TenantMode` reads exactly that number to decide whether a deployment has tenants.
 *
 * SKIPPED when no server is reachable, deliberately. A suite that needed MySQL to pass would make
 * every contributor install one; a suite that could never exercise it is how the driver got here.
 * Point `MYSQL_TEST_URL` at a server and these run.
 */
const url = process.env.MYSQL_TEST_URL || 'mysql://root:rootpw@127.0.0.1:3399/mysql';

const reachable = async (): Promise<boolean> => {
  try {
    const probe: any = new MysqlDatabaseManager(url);
    await probe.connect();
    await probe.execute(sql`SELECT 1`);
    return true;
  } catch {
    return false;
  }
};

describe('MySQL read operations, against a live server', async () => {
  const available = await reachable();
  const table = '_fc_read_ops_probe';
  let db: any;

  beforeAll(async () => {
    if (!available) return;
    db = new MysqlDatabaseManager(url);
    await db.connect();
    await db.execute(sql.raw(`DROP TABLE IF EXISTS ${table}`));
    await db.execute(sql.raw(
      `CREATE TABLE ${table} (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(191), kind VARCHAR(64))`));
    for (const [name, kind] of [['first', 'a'], ['second', 'a'], ['third', 'b']]) {
      await db.execute(sql.raw(`INSERT INTO ${table} (name, kind) VALUES ('${name}', '${kind}')`));
    }
  });

  afterAll(async () => {
    if (!available || !db) return;
    await db.execute(sql.raw(`DROP TABLE IF EXISTS ${table}`));
  });

  it.skipIf(!available)('returns an ARRAY of every row, not the first one', async () => {
    const rows = await db.find(table);

    expect(Array.isArray(rows)).toBe(true);
    expect(rows).toHaveLength(3);
    expect(rows.map((row: any) => row.name).sort()).toEqual(['first', 'second', 'third']);
  });

  it.skipIf(!available)('selects every column when the caller asked for none', async () => {
    const [row] = await db.find(table);

    // The failure this replaces was `select  from` — a syntax error, not a missing column.
    expect(row.name).toBeDefined();
    expect(row.kind).toBeDefined();
  });

  it.skipIf(!available)('still honours an explicit column list', async () => {
    const rows = await db.find(table, { columns: { name: true } });

    expect(rows).toHaveLength(3);
    expect(rows[0].name).toBeDefined();
  });

  it.skipIf(!available)('counts rows rather than answering 0 for everything', async () => {
    expect(await db.count(table)).toBe(3);
    expect(await db.count(table, { where: { kind: 'a' } })).toBe(2);
  });

  it.skipIf(!available)('agrees with itself: count() equals the number of rows find() returns', async () => {
    expect(await db.count(table)).toBe((await db.find(table)).length);
  });

  it.skipIf(!available)('reads a table\'s columns, in the current schema only', async () => {
    const columns = await db.getColumns(table);

    // MySQL 8 answers `COLUMN_NAME` in upper case; reading the lower-case key got undefined from
    // every row, which surfaced as "Cannot read properties of undefined" rather than as anything
    // about columns.
    expect(columns).toContain('name');
    expect(columns).toContain('kind');
  });

  it.skipIf(!available)('accepts double-quoted identifiers, because ANSI_QUOTES is set per connection', async () => {
    // Without ANSI_QUOTES MySQL reads "id" as the STRING 'id', so every migration in the tree — all
    // of which quote identifiers this way — would parse as nonsense.
    const result: any = await db.execute(sql.raw(`SELECT "id" FROM "${table}" LIMIT 1`));
    expect(result).toBeDefined();
  });

  it.skipIf(!available)('translates CREATE INDEX IF NOT EXISTS, which MySQL does not have', async () => {
    const statement = sql.raw(`CREATE INDEX IF NOT EXISTS "idx_probe_kind" ON "${table}" ("kind")`);

    await db.execute(statement);
    // Twice, because "if not exists" means the second one is a no-op rather than a duplicate-key error.
    await expect(db.execute(statement)).resolves.not.toThrow();
  });
});

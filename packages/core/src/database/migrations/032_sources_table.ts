import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';
import { DialectHelper } from '@core/database/helpers/dialect';

/**
 * The framework now owns the Sources table, because Sources is no longer a plugin.
 *
 * It used to be created by a plugin's collection registration — the schema manager saw a collection
 * declared at boot and made the table. Framework code does not register collections, so without this
 * a fresh installation would bring up the screen against a table nobody had created, and the first
 * thing an operator did would fail on a missing relation.
 *
 * Migration 031 renames the table on installations that already had it, and runs first. This one
 * creates it only when it is absent, so the two never fight: an upgraded installation arrives here
 * with the table already present and its data intact, and nothing happens.
 */
export class SourcesTableMigration extends BaseMigration {
  readonly version = 32;
  readonly name = 'The framework owns the Sources table';

  private static readonly TABLE = 'fcp_sources_builds';

  async up(db: IDatabaseManager): Promise<void> {
    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        await db.execute(sql.raw(SourcesTableMigration.createStatement('SERIAL PRIMARY KEY', 'TIMESTAMPTZ')));
        // Row-level security, exactly as every other tenant-scoped table gets it. The column, its
        // default, the index, ENABLE + FORCE and the policy all come from the framework's own helper
        // so this table cannot drift from the rest.
        await db.tenantIsolation.isolateTable(SourcesTableMigration.TABLE);
      },
      sqlite: async () => {
        await db.execute(sql.raw(SourcesTableMigration.createStatement('INTEGER PRIMARY KEY AUTOINCREMENT', 'TEXT')));
      },
      mysql: async () => {
        // `slug` carries a UNIQUE, `type` joins it in migration 037's composite index, and `branch`,
        // `last_build_status` and `disable_permalink` each carry a DEFAULT — none of those five can
        // be TEXT in MySQL, so they get VARCHAR(191) here.
        await db.execute(sql.raw(
          SourcesTableMigration.createStatement('INT AUTO_INCREMENT PRIMARY KEY', 'TIMESTAMP NULL', 'VARCHAR(191)'),
        ));
      },
    });
  }

  /**
   * One shape, three dialects.
   *
   * `IF NOT EXISTS` is what makes this safe beside migration 031: on an upgraded installation the
   * table is already there, carrying the operator's tracked repositories, and this must not touch it.
   */
  private static createStatement(idColumn: string, timestamp: string, key: string = 'TEXT'): string {
    return `CREATE TABLE IF NOT EXISTS ${SourcesTableMigration.TABLE} (
      id ${idColumn},
      created_at ${timestamp} DEFAULT CURRENT_TIMESTAMP,
      updated_at ${timestamp} DEFAULT CURRENT_TIMESTAMP,
      slug ${key} NOT NULL UNIQUE,
      type ${key} NOT NULL,
      git_url TEXT NOT NULL,
      branch ${key} NOT NULL DEFAULT 'main',
      git_secret TEXT,
      last_commit_sha TEXT,
      last_build_at TEXT,
      last_build_status ${key} DEFAULT 'pending',
      last_error TEXT,
      version TEXT,
      file_name TEXT,
      artifact_sha256 TEXT,
      custom_permalink TEXT,
      disable_permalink ${key} DEFAULT 'false',
      auto_build BOOLEAN DEFAULT FALSE,
      auto_update BOOLEAN DEFAULT FALSE,
      changelog TEXT
    )`;
  }
}

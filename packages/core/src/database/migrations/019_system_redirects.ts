import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';
import { DialectHelper } from '@core/database/helpers/dialect';

/**
 * URL redirect rules — ONE framework-owned store. Before this, the identical capability lived in two
 * plugins, each with its own table, schema, admin surface and resolver, first-match-wins by plugin
 * boot order. Redirects are routing, and routing is framework
 * territory (permalinks, resolution, the redirect registry all live here) — so the rules do too, and a
 * bare install with no plugin at all still supports them.
 *
 * `from_path` is unique — one rule per retired path. `type` is '301' (permanent → 308 at the routing
 * layer) or '302' (temporary → 307). Hit counting is maintained by the framework's own resolver.
 *
 * It used to also copy the rows out of those two plugins' tables. Every deployment ran that once, and
 * both plugins have since stopped creating their tables, so on any install today there is nothing to
 * copy — and the step could only do its job by naming the plugins, which the framework never does.
 */
export class SystemRedirectsMigration extends BaseMigration {
  readonly version = 19;
  readonly name = 'Create _system_redirects (framework-owned URL redirect rules)';

  async up(db: IDatabaseManager): Promise<void> {
    await this.createTable(db);
  }

  private async createTable(db: IDatabaseManager): Promise<void> {
    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS "_system_redirects" (
            "id" SERIAL PRIMARY KEY,
            "from_path" TEXT NOT NULL UNIQUE,
            "to_path" TEXT NOT NULL,
            "type" TEXT NOT NULL DEFAULT '301',
            "enabled" INTEGER NOT NULL DEFAULT 1,
            "hit_count" INTEGER NOT NULL DEFAULT 0,
            "notes" TEXT DEFAULT '',
            "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        await db.execute(sql`
          CREATE INDEX IF NOT EXISTS "idx_system_redirects_lookup"
            ON "_system_redirects" ("from_path", "enabled")
        `);
      },
      mysql: async () => {
        await db.execute(sql.raw(`
          CREATE TABLE IF NOT EXISTS _system_redirects (
            id INT AUTO_INCREMENT PRIMARY KEY,
            -- 512, not 768. These tables are utf8mb4, so an index counts 4 bytes per character:
            -- 768 is exactly InnoDB's 3072-byte ceiling for the UNIQUE alone, and the composite
            -- index below adds enabled on top, which puts it over. The table could never be
            -- created on MySQL. 512*4 = 2048 leaves room for both.
            from_path VARCHAR(512) NOT NULL UNIQUE,
            to_path TEXT NOT NULL,
            type VARCHAR(8) NOT NULL DEFAULT '301',
            enabled INT NOT NULL DEFAULT 1,
            hit_count INT NOT NULL DEFAULT 0,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_system_redirects_lookup (from_path, enabled)
          )
        `));
      },
      sqlite: async () => {
        await db.execute(sql.raw(`
          CREATE TABLE IF NOT EXISTS "_system_redirects" (
            "id" INTEGER PRIMARY KEY AUTOINCREMENT,
            "from_path" TEXT NOT NULL UNIQUE,
            "to_path" TEXT NOT NULL,
            "type" TEXT NOT NULL DEFAULT '301',
            "enabled" INTEGER NOT NULL DEFAULT 1,
            "hit_count" INTEGER NOT NULL DEFAULT 0,
            "notes" TEXT DEFAULT '',
            "created_at" TEXT DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `));
        await db.execute(sql.raw(`
          CREATE INDEX IF NOT EXISTS "idx_system_redirects_lookup"
            ON "_system_redirects" ("from_path", "enabled")
        `));
      },
    });
  }
}

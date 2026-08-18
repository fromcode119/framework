import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';
import { DialectHelper } from '@core/database/helpers/dialect';

/**
 * URL redirect rules — ONE framework-owned store. Before this, the identical capability lived in TWO
 * plugins (cms `fcp_cms_redirects` + seo `fcp_seo_redirects`), each with its own schema, admin surface
 * and resolver, first-match-wins by plugin boot order. Redirects are routing, and routing is framework
 * territory (permalinks, resolution, the redirect registry all live here) — so the rules do too, and a
 * bare install with neither plugin still supports them.
 *
 * `from_path` is unique — one rule per retired path. `type` is '301' (permanent → 308 at the routing
 * layer) or '302' (temporary → 307). Hit counting is maintained by the framework's own resolver.
 *
 * The copy step migrates any rows the plugin tables hold (cms first — it is the one with live data;
 * seo's differently-named columns are mapped). Idempotent per row via the from_path uniqueness check,
 * and the plugin tables are left in place — dropping them belongs to those plugins' own migrations.
 */
export class SystemRedirectsMigration extends BaseMigration {
  readonly version = 19;
  readonly name = 'Create _system_redirects (framework-owned URL redirect rules)';

  async up(db: IDatabaseManager): Promise<void> {
    await this.createTable(db);
    await this.copyRowsFromPluginTables(db);
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
            from_path VARCHAR(768) NOT NULL UNIQUE,
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

  private async copyRowsFromPluginTables(db: IDatabaseManager): Promise<void> {
    // cms first: identical column meanings, and it is the table with live data.
    await this.copyRows(db, 'fcp_cms_redirects', (row) => ({
      from_path: String(row.from_path ?? '').trim(),
      to_path: String(row.to_path ?? '').trim(),
      type: String(row.type ?? '301') === '302' ? '302' : '301',
      enabled: this.toIntFlag(row.enabled),
      hit_count: Number(row.hit_count ?? 0) || 0,
      notes: String(row.notes ?? ''),
    }));
    await this.copyRows(db, 'fcp_seo_redirects', (row) => ({
      from_path: String(row.source_path ?? '').trim(),
      to_path: String(row.target_path ?? '').trim(),
      type: String(row.redirect_type ?? '301') === '302' ? '302' : '301',
      enabled: this.toIntFlag(row.is_active),
      hit_count: Number(row.hits ?? 0) || 0,
      notes: '',
    }));
  }

  private async copyRows(
    db: IDatabaseManager,
    table: string,
    map: (row: Record<string, unknown>) => Record<string, unknown>,
  ): Promise<void> {
    if (!(await db.tableExists(table))) return;
    const rows = (await db.find(table, { limit: 10_000 })) as Record<string, unknown>[];
    for (const row of rows) {
      const mapped = map(row);
      if (!mapped.from_path || !mapped.to_path) continue;
      const existing = await db.findOne('_system_redirects', { from_path: mapped.from_path });
      if (existing) continue;
      await db.insert('_system_redirects', mapped);
    }
  }

  /** cms stored booleans loosely (`1.0`, `'true'`, `true`) — anything not explicitly falsy is on. */
  private toIntFlag(value: unknown): number {
    const raw = String(value ?? '').trim().toLowerCase();
    if (raw === '' || raw === '0' || raw === '0.0' || raw === 'false' || raw === 'no') return 0;
    return 1;
  }
}

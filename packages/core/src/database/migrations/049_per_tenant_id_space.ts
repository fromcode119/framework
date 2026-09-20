import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';
import { DialectHelper } from '@core/database/helpers/dialect';
import { Logger } from '@core/logging';

/**
 * Gives each site its own id space, so an import can keep the ids it arrives with.
 *
 * Every site's rows live in the same tables, and the primary key is `id` alone — one pool of numbers
 * shared by all of them. So an archive carrying order 157 cannot simply be inserted when order 157
 * already belongs to somebody else, and the importer has no choice: it hands out fresh numbers and
 * rewrites every reference that pointed at the old ones.
 *
 * That rewrite is the whole problem. It is only correct while the catalog of references is complete,
 * and twice it was not — a pointer whose target table is named by a sibling column, and an id
 * declared inside a `json` document. Rows kept numbers belonging to another site's records, and the
 * repair had to reconstruct, by hand and out of band, a mapping the importer had already computed
 * and discarded.
 *
 * Widening the key to `(tenant_id, id)` removes the reason to renumber at all. Nothing to rewrite,
 * so nothing to miss.
 *
 * WHY THIS COSTS NO DATA CHANGE. Ids are globally unique today, which means they are ALREADY unique
 * within each site — every existing row satisfies the new key before this runs. This adds a column
 * to a constraint; it does not renumber anything, and it cannot collide.
 *
 * The sequence stays exactly as it is. New rows keep drawing from it and keep getting globally
 * distinct numbers; that is now a coincidence rather than a requirement, which is the point. What
 * changes is only that an INSERT naming its own id no longer has to be unique across sites.
 *
 * NOT applied to `_system_*`. Those are platform configuration — certificates, sessions, plugin and
 * theme bindings — read across sites by the platform admin by design, which is why they carry no
 * row-level security. An import never inserts into them, so they have nothing to gain and a
 * cross-site read to lose.
 *
 * The table list is DERIVED, not written down: tenant-scoped, row-level security on, and a primary
 * key of `id` alone. A hand-listed set goes stale the first time a plugin adds a collection.
 */
export class PerTenantIdSpaceMigration extends BaseMigration {
  readonly version = 49;
  readonly name = 'Each site gets its own id space, so an import keeps the ids it arrives with';

  private static readonly logger = new Logger({ namespace: 'PerTenantIdSpaceMigration' });

  /**
   * The five foreign keys pointing AT a table whose key is widening.
   *
   * A foreign key needs a unique target, so each has to grow the same column its parent just did.
   * Every child here is itself tenant-scoped and already carries `tenant_id`, so the composite
   * reference is expressible — and it is strictly stronger than what it replaces: a child can no
   * longer point at a parent belonging to a different site, which the single-column version allowed.
   *
   * The other ten foreign keys in the schema target `_system_*` or `users`, none of which change.
   */
  private static readonly COMPOSITE_KEYS = [
    { constraint: 'media_folder_id_fkey', child: 'media', column: 'folder_id', parent: 'media_folders' },
    { constraint: 'media_folders_parent_id_fkey', child: 'media_folders', column: 'parent_id', parent: 'media_folders' },
    { constraint: 'people_addresses_person_id_fkey', child: 'people_addresses', column: 'person_id', parent: 'people' },
    { constraint: 'person_relationships_to_person_id_fkey', child: 'person_relationships', column: 'to_person_id', parent: 'people' },
    { constraint: 'person_relationships_from_person_id_fkey', child: 'person_relationships', column: 'from_person_id', parent: 'people' },
  ] as const;

  async up(db: IDatabaseManager): Promise<void> {
    const { logger } = PerTenantIdSpaceMigration;

    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        const tables = await PerTenantIdSpaceMigration.widenable(db);
        if (!tables.length) {
          logger.info('Every tenant-scoped table already keys on (tenant_id, id); nothing to widen.');
          return;
        }

        // The five composite references are dropped first and rebuilt last: a foreign key pins the
        // unique constraint it points at, so the parent's key cannot be replaced while they hold it.
        for (const key of PerTenantIdSpaceMigration.COMPOSITE_KEYS) {
          await db.execute(sql.raw(`ALTER TABLE ${key.child} DROP CONSTRAINT IF EXISTS ${key.constraint}`));
        }

        for (const table of tables) {
          const constraint = await PerTenantIdSpaceMigration.primaryKeyName(db, table);
          if (constraint) await db.execute(sql.raw(`ALTER TABLE ${table} DROP CONSTRAINT ${constraint}`));
          await db.execute(sql.raw(`ALTER TABLE ${table} ADD PRIMARY KEY (tenant_id, id)`));
        }

        // An id is still looked up on its own — by the reference walk, by a plugin reading a row it
        // was handed — and the widened key no longer serves that, because `id` is now its second
        // column. This index is what keeps those reads from turning into scans.
        for (const table of tables) {
          await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_${table}_id ON ${table} (id)`));
        }

        for (const key of PerTenantIdSpaceMigration.COMPOSITE_KEYS) {
          await db.execute(sql.raw(
            `ALTER TABLE ${key.child} ADD CONSTRAINT ${key.constraint} `
            + `FOREIGN KEY (tenant_id, ${key.column}) REFERENCES ${key.parent} (tenant_id, id)`,
          ));
        }

        logger.info(`Widened ${tables.length} table(s) to (tenant_id, id); an import can now keep its own ids.`);
      },

      // SQLite cannot alter a primary key — it would mean rebuilding every table — and it is
      // single-site by definition here (no row-level security, so no second site to collide with).
      // There is nothing for this migration to fix there.
      sqlite: async () => {
        logger.info('SQLite is single-site, so ids never collide across sites; nothing to widen.');
      },

      // MySQL has no row-level security either, so it is single-site for the same reason.
      mysql: async () => {
        logger.info('MySQL is single-site here, so ids never collide across sites; nothing to widen.');
      },
    });
  }

  /**
   * Narrowing back is a real risk, not a formality: once a site has imported and KEPT its own ids,
   * two sites can hold the same number, and `PRIMARY KEY (id)` then cannot be recreated at all. The
   * rollback restores the old shape only while that has not happened yet, and says so rather than
   * failing with a duplicate-key error nobody expects from a down migration.
   */
  async down(db: IDatabaseManager): Promise<void> {
    const { logger } = PerTenantIdSpaceMigration;

    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        const clashes = await PerTenantIdSpaceMigration.duplicatedIds(db);
        if (clashes.length) {
          throw new Error(
            `[arch] Cannot narrow the key back: ${clashes.length} table(s) already hold the same id for `
            + `more than one site (${clashes.slice(0, 3).join(', ')}${clashes.length > 3 ? ', …' : ''}). `
            + 'Those rows would have to be renumbered first, which is the work this migration exists to avoid.',
          );
        }
        logger.warn('Narrowing the key back to (id); an import will renumber again from here on.');
        for (const key of PerTenantIdSpaceMigration.COMPOSITE_KEYS) {
          await db.execute(sql.raw(`ALTER TABLE ${key.child} DROP CONSTRAINT IF EXISTS ${key.constraint}`));
        }
        for (const table of await PerTenantIdSpaceMigration.widened(db)) {
          const constraint = await PerTenantIdSpaceMigration.primaryKeyName(db, table);
          if (constraint) await db.execute(sql.raw(`ALTER TABLE ${table} DROP CONSTRAINT ${constraint}`));
          await db.execute(sql.raw(`ALTER TABLE ${table} ADD PRIMARY KEY (id)`));
        }
        for (const key of PerTenantIdSpaceMigration.COMPOSITE_KEYS) {
          await db.execute(sql.raw(
            `ALTER TABLE ${key.child} ADD CONSTRAINT ${key.constraint} `
            + `FOREIGN KEY (${key.column}) REFERENCES ${key.parent} (id)`,
          ));
        }
      },
      sqlite: async () => undefined,
      mysql: async () => undefined,
    });
  }

  /** Tenant-scoped, row-level security on, primary key of `id` alone — the tables this applies to. */
  private static async widenable(db: IDatabaseManager): Promise<string[]> {
    return PerTenantIdSpaceMigration.tablesKeyedOn(db, 1);
  }

  /** The same set, already widened — used by the rollback to find what to narrow. */
  private static async widened(db: IDatabaseManager): Promise<string[]> {
    return PerTenantIdSpaceMigration.tablesKeyedOn(db, 2);
  }

  private static async tablesKeyedOn(db: IDatabaseManager, columns: number): Promise<string[]> {
    const rows = await db.queryRaw(
      `SELECT t.relname AS name
         FROM pg_class t
         JOIN pg_namespace n ON n.oid = t.relnamespace
         JOIN pg_index i ON i.indrelid = t.oid AND i.indisprimary
        WHERE t.relkind = 'r'
          AND n.nspname = 'public'
          AND t.relrowsecurity
          AND t.relname NOT LIKE '\\_system\\_%'
          AND array_length(i.indkey, 1) = ${columns}
          AND EXISTS (SELECT 1 FROM pg_attribute a
                       WHERE a.attrelid = t.oid AND a.attname = 'tenant_id' AND a.attnum > 0)
        ORDER BY t.relname`,
    );
    return rows.map((row: any) => String(row.name));
  }

  /** Tables where two sites already share an id — the thing that makes narrowing impossible. */
  private static async duplicatedIds(db: IDatabaseManager): Promise<string[]> {
    const found: string[] = [];
    for (const table of await PerTenantIdSpaceMigration.widened(db)) {
      const rows = await db.queryRaw(
        `SELECT 1 AS clash FROM ${table} GROUP BY id HAVING COUNT(*) > 1 LIMIT 1`,
      );
      if (rows.length) found.push(table);
    }
    return found;
  }

  private static async primaryKeyName(db: IDatabaseManager, table: string): Promise<string | null> {
    const rows = await db.queryRaw(
      `SELECT c.conname AS name FROM pg_constraint c
         JOIN pg_class t ON t.oid = c.conrelid
        WHERE c.contype = 'p' AND t.relname = '${table}' LIMIT 1`,
    );
    return rows.length ? String(rows[0].name) : null;
  }
}

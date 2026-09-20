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
 * That rewrite is the whole problem. It is correct only while the catalog of references is complete,
 * and twice it was not — a pointer whose target table is named by a sibling column, and an id inside
 * a `json` document. Rows kept numbers belonging to another site's records, and the repair had to
 * reconstruct, by hand, a mapping the importer had computed and discarded.
 *
 * Widening the key to `(tenant_id, id)` removes the reason to renumber. Nothing to rewrite, so
 * nothing to miss.
 *
 * WHY THIS COSTS NO DATA CHANGE. Ids are globally unique today, so they are ALREADY unique within
 * each site — every existing row satisfies the new key before this runs. It adds a column to a
 * constraint; it renumbers nothing and cannot collide. The sequence is untouched.
 *
 * NOT applied to `_system_*`: platform configuration, read across sites by design, which is why it
 * carries no row-level security. An import never inserts into it.
 *
 * The table list is DERIVED — tenant-scoped, row-level security on, primary key of `id` alone. A
 * hand-listed set goes stale the first time a plugin adds a collection. And a table that cannot take
 * the key is left with the one it has, rather than failing the whole migration: see `widenOne`.
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
    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => PerTenantIdSpaceMigration.widenAll(db),

      // SQLite cannot alter a primary key — it would mean rebuilding every table — and it is
      // single-site by definition here (no row-level security, so no second site to collide with).
      // There is nothing for this migration to fix there.
      sqlite: async () => {
        PerTenantIdSpaceMigration.logger.info('SQLite is single-site, so ids never collide across sites; nothing to widen.');
      },

      // MySQL has no row-level security either, so it is single-site for the same reason.
      mysql: async () => {
        PerTenantIdSpaceMigration.logger.info('MySQL is single-site here, so ids never collide across sites; nothing to widen.');
      },
    });
  }

  /**
   * The whole Postgres change. Every table that CAN take the key gets it; the rest keep the one they
   * have, and are named.
   *
   * NO SURROUNDING TRANSACTION, deliberately. Outside a tenant scope this manager runs each statement
   * on whatever client the POOL hands it — `executor` is the pool and `orm` is the pool-wide Drizzle
   * — so a `BEGIN` issued here would wrap nothing and would strand an open transaction on one pooled
   * client. Atomicity is bought per statement instead, which is where it is actually needed.
   *
   * It is IDEMPOTENT for the same reason. `widenable` only returns tables still keyed on `id` alone,
   * so a run that dies half way is continued by the next one rather than confused by it, and the
   * references are restored from what the parents turn out to be, not from what this run did.
   */
  private static async widenAll(db: IDatabaseManager): Promise<void> {
    const { logger } = PerTenantIdSpaceMigration;

    const candidates = await PerTenantIdSpaceMigration.widenable(db);

    // READ BEFORE DROPPING. Four of the five cascade on delete and one nulls the reference, and
    // rebuilding them without that silently turns "deleting a person removes their addresses" into
    // "deleting a person is refused". Taken from the catalog rather than written down here, so a
    // deployment that chose different actions keeps its own.
    const actions = await PerTenantIdSpaceMigration.referentialActions(db);

    if (!candidates.length) {
      logger.info('Every tenant-scoped table already keys on (tenant_id, id); nothing to widen.');
      await PerTenantIdSpaceMigration.restoreForeignKeys(db, actions);
      return;
    }

    // The five composite references are dropped first and rebuilt last: a foreign key pins the unique
    // constraint it points at, so the parent's key cannot be replaced while they hold it.
    for (const key of PerTenantIdSpaceMigration.COMPOSITE_KEYS) {
      if (!(await PerTenantIdSpaceMigration.tableExists(db, key.child))) continue;
      await db.execute(sql.raw(`ALTER TABLE ${key.child} DROP CONSTRAINT IF EXISTS ${key.constraint}`));
    }

    const widened: string[] = [];
    const refused = new Map<string, string>();
    for (const table of candidates) {
      const reason = await PerTenantIdSpaceMigration.widenOne(db, table);
      if (reason) refused.set(table, reason); else widened.push(table);
    }

    await PerTenantIdSpaceMigration.restoreForeignKeys(db, actions);

    logger.info(`Widened ${widened.length} table(s) to (tenant_id, id); an import can now keep its own ids.`);
    if (refused.size) PerTenantIdSpaceMigration.reportRefused(refused);
  }

  /**
   * Widen ONE table, or report why it cannot be — attempted rather than predicted, in ONE statement.
   *
   * Predicting does not work here, and the reason is worth stating. A table holding rows with no
   * owner cannot take this key: the ownership column becomes a key column, and a key column cannot be
   * null. But this runs as the schema OWNER, which is deliberately NOSUPERUSER and NOBYPASSRLS, and
   * these tables FORCE row-level security — so `SELECT ... WHERE tenant_id IS NULL` returns NOTHING,
   * every time, because the isolation predicate is strict equality and NULL matches in no scope.
   * `ALTER TABLE` is not subject to that. Rehearsed against the real schema, the check read clean and
   * the alter then failed.
   *
   * ONE statement carrying BOTH actions is what makes a failure harmless: Postgres applies an
   * `ALTER TABLE` atomically, so the table either comes out widened or keeps exactly the key it had.
   * Two statements would leave it with none at all, which is the state nothing else in the system
   * expects and no later run would repair.
   *
   * Attempting also covers reasons nobody anticipated — two sites already sharing an id, say — and
   * reports the database's own words rather than a guess at them.
   */
  private static async widenOne(db: IDatabaseManager, table: string): Promise<string | null> {
    try {
      const constraint = await PerTenantIdSpaceMigration.primaryKeyName(db, table);
      const drop = constraint ? `DROP CONSTRAINT ${constraint}, ` : '';
      await db.execute(sql.raw(`ALTER TABLE ${table} ${drop}ADD PRIMARY KEY (tenant_id, id)`));

      // An id is still looked up on its own — by the reference walk, by a plugin reading a row it was
      // handed — and the widened key no longer serves that, because `id` is now its second column.
      // This index is what keeps those reads from turning into scans.
      await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_${table}_id ON ${table} (id)`));
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }

  /**
   * Say which tables were left behind and why: a migration that quietly does less than its name is
   * how a half-applied schema goes unnoticed.
   *
   * Measured on the real platform: 20 rows with no owner across 8 tables, left by an adoption that
   * stamped only the tables which already had the column. Those keep the shared key and go on
   * renumbering on import — correct, and the path this migration exists to avoid.
   */
  private static reportRefused(refused: Map<string, string>): void {
    PerTenantIdSpaceMigration.logger.warn(
      `${refused.size} table(s) did NOT get their own id space and keep the shared key: `
      + `${[...refused].map(([table, why]) => `${table} (${why})`).join('; ')}. `
      + 'An import still renumbers those, which is correct but is the expensive path. The usual cause '
      + 'is rows with no owner, which cannot be keyed on — give them an owner and re-running completes it.',
    );
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
        const actions = await PerTenantIdSpaceMigration.referentialActions(db);
        for (const key of PerTenantIdSpaceMigration.COMPOSITE_KEYS) {
          if (!(await PerTenantIdSpaceMigration.tableExists(db, key.child))) continue;
          await db.execute(sql.raw(`ALTER TABLE ${key.child} DROP CONSTRAINT IF EXISTS ${key.constraint}`));
        }
        for (const table of await PerTenantIdSpaceMigration.widened(db)) {
          const constraint = await PerTenantIdSpaceMigration.primaryKeyName(db, table);
          if (constraint) await db.execute(sql.raw(`ALTER TABLE ${table} DROP CONSTRAINT ${constraint}`));
          await db.execute(sql.raw(`ALTER TABLE ${table} ADD PRIMARY KEY (id)`));
        }
        await PerTenantIdSpaceMigration.restoreForeignKeys(db, actions);
      },
      sqlite: async () => undefined,
      mysql: async () => undefined,
    });
  }

  /**
   * Puts the five references back, each in the shape its PARENT can actually accept.
   *
   * They were dropped so the parent's key could be replaced — a foreign key pins the unique
   * constraint it points at — and rebuilding them all as composite was wrong: only a parent that was
   * actually widened has a `(tenant_id, id)` unique constraint to point at. Which parents those are
   * depends on the database, not on this file: the widening set is derived (tenant-scoped, row-level
   * security on), and a deployment that has not adopted tenancy yet has none of it. On a fresh
   * install that difference is the whole run, and asserting the composite shape there fails with
   * "there is no unique constraint matching the given keys".
   *
   * So the parent is asked, after the widening, and each key is rebuilt to match. The same routine
   * serves the rollback, where every parent has narrowed back and every key comes out single-column.
   */
  private static async restoreForeignKeys(db: IDatabaseManager, actions: Map<string, string>): Promise<void> {
    const perTenant = new Set(await PerTenantIdSpaceMigration.widened(db));

    for (const key of PerTenantIdSpaceMigration.COMPOSITE_KEYS) {
      if (!(await PerTenantIdSpaceMigration.tableExists(db, key.child))) continue;
      if (!(await PerTenantIdSpaceMigration.tableExists(db, key.parent))) continue;

      const composite = perTenant.has(key.parent) && await PerTenantIdSpaceMigration.hasTenantColumn(db, key.child);
      await db.execute(sql.raw(
        `ALTER TABLE ${key.child} ADD CONSTRAINT ${key.constraint} `
        + (composite
          ? `FOREIGN KEY (tenant_id, ${key.column}) REFERENCES ${key.parent} (tenant_id, id)`
          : `FOREIGN KEY (${key.column}) REFERENCES ${key.parent} (id)`)
        + (actions.get(key.constraint) ?? ''),
      ));
    }
  }

  /**
   * What each of the five references does on DELETE and on UPDATE, as the clause that recreates it.
   *
   * Read from the catalog, not written down: these actions are part of how the product behaves —
   * removing a person removes their addresses, removing a folder unfiles its media — and a rebuild
   * that drops them turns those deletes into refusals without anything saying so. A deployment whose
   * actions differ from ours keeps its own.
   *
   * An absent entry means NO ACTION, which is Postgres's default and needs no clause.
   */
  private static async referentialActions(db: IDatabaseManager): Promise<Map<string, string>> {
    const WORDS: Record<string, string> = { r: 'RESTRICT', c: 'CASCADE', n: 'SET NULL', d: 'SET DEFAULT' };
    const names = PerTenantIdSpaceMigration.COMPOSITE_KEYS.map((key) => `'${key.constraint}'`).join(', ');

    const rows = await db.queryRaw(
      `SELECT conname AS name, confdeltype::text AS del, confupdtype::text AS upd
         FROM pg_constraint WHERE contype = 'f' AND conname IN (${names})`,
    );

    const found = new Map<string, string>();
    for (const row of rows) {
      const clause = (WORDS[String(row.del)] ? ` ON DELETE ${WORDS[String(row.del)]}` : '')
        + (WORDS[String(row.upd)] ? ` ON UPDATE ${WORDS[String(row.upd)]}` : '');
      if (clause) found.set(String(row.name), clause);
    }
    return found;
  }

  private static async tableExists(db: IDatabaseManager, table: string): Promise<boolean> {
    const rows = await db.queryRaw(
      `SELECT 1 AS present FROM pg_class t JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public' AND t.relkind = 'r' AND t.relname = '${table}' LIMIT 1`,
    );
    return rows.length > 0;
  }

  private static async hasTenantColumn(db: IDatabaseManager, table: string): Promise<boolean> {
    const rows = await db.queryRaw(
      `SELECT 1 AS present FROM pg_attribute a JOIN pg_class t ON t.oid = a.attrelid
         JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public' AND t.relname = '${table}' AND a.attname = 'tenant_id' AND a.attnum > 0 LIMIT 1`,
    );
    return rows.length > 0;
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

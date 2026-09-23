import { DialectHelper } from '@core/database/helpers/dialect';
import { Logger } from '@core/logging';
import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';

/**
 * Site-owned data: what belongs to one site, and how a site's records keep their identity.
 *
 * A theme or plugin may belong to one site instead of the platform; a role records the plugin that
 * created it; an import keeps the old-id to new-id map it built, so a missed reference can be
 * re-pointed later; and every site has its own id space, so an import keeps the ids it arrives with —
 * with the ON DELETE actions of the widened keys exactly as they were.
 *
 * Versions 45, 46 and 48–50 consolidated. A database that ran them has all five recorded and runs
 * nothing here.
 */
export class SiteOwnedDataMigration extends BaseMigration {
  readonly version = 45;
  readonly name = 'Site-owned artifacts, roles and id space';

  async up(db: IDatabaseManager): Promise<void> {
    await this.v045TenantOwnedArtifacts(db);
    await this.v046RoleRecordsItsPlugin(db);
    await this.v048TenantImportRemap(db);
    await this.v049PerTenantIdSpace(db);
    await this.v050RestoreReferenceActions(db);
  }

  private static readonly COLUMN = 'owner_tenant_id';

  private static readonly TABLES = ['_system_themes', '_system_plugins'] as const;

  private static readonly logger = new Logger({ namespace: 'SiteOwnedDataMigration' });


  /**
   * Whether the column is already there, asked before adding it.
   *
   * `information_schema` is PostgreSQL's and MySQL's; SQLite answers with `PRAGMA table_info` and
   * errors on the other form, which would take the whole boot down on that driver.
   */
  private async hasOwnerColumn(db: IDatabaseManager, table: string): Promise<boolean> {
    const { COLUMN } = SiteOwnedDataMigration;
    let present = false;

    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        present = SiteOwnedDataMigration.hasRow(await db.execute(sql.raw(
          `SELECT 1 AS present FROM information_schema.columns
            WHERE table_name = '${table}' AND column_name = '${COLUMN}'`,
        )));
      },
      sqlite: async () => {
        const result: any = await db.execute(sql.raw(`PRAGMA table_info(${table})`));
        const rows: any[] = Array.isArray(result) ? result : (result?.rows ?? []);
        present = rows.some((row: any) => String(row?.name || '') === COLUMN);
      },
      mysql: async () => {
        // Scoped to this schema — `information_schema` spans every database on the server.
        present = SiteOwnedDataMigration.hasRow(await db.execute(sql.raw(
          `SELECT 1 AS present FROM information_schema.columns
            WHERE table_schema = DATABASE() AND table_name = '${table}' AND column_name = '${COLUMN}'`,
        )));
      },
    });

    return present;
  }


  private static hasRow(result: any): boolean {
    const rows: any[] = Array.isArray(result) ? result : (result?.rows ?? []);
    return rows.length > 0;
  }

  private static readonly TABLE = '_system_roles';

  private static readonly COLUMN_V46 = 'plugin_slug';

  private static readonly loggerV46 = new Logger({ namespace: 'SiteOwnedDataMigration' });


  /** Whether the column is already there. SQLite answers with PRAGMA and errors on information_schema. */
  private async hasColumn(db: IDatabaseManager, table: string, column: string): Promise<boolean> {
    let present = false;

    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        present = SiteOwnedDataMigration.hasRowV46(await db.execute(sql.raw(
          `SELECT 1 AS present FROM information_schema.columns
            WHERE table_name = '${table}' AND column_name = '${column}'`,
        )));
      },
      sqlite: async () => {
        const result: any = await db.execute(sql.raw(`PRAGMA table_info(${table})`));
        const rows: any[] = Array.isArray(result) ? result : (result?.rows ?? []);
        present = rows.some((row: any) => String(row?.name || '') === column);
      },
      mysql: async () => {
        present = SiteOwnedDataMigration.hasRowV46(await db.execute(sql.raw(
          `SELECT 1 AS present FROM information_schema.columns
            WHERE table_schema = DATABASE() AND table_name = '${table}' AND column_name = '${column}'`,
        )));
      },
    });

    return present;
  }


  private static hasRowV46(result: any): boolean {
    const rows: any[] = Array.isArray(result) ? result : (result?.rows ?? []);
    return rows.length > 0;
  }

  private static readonly TABLE_V48 = '_system_tenant_import_remap';

  private static readonly loggerV48 = new Logger({ namespace: 'SiteOwnedDataMigration' });


  /**
   * Presence, asked per dialect: SQLite has no `information_schema` to query.
   *
   * `executeForDialect` resolves to nothing, so the answer is captured in a local rather than
   * returned from the branch — the same shape migration 045 uses for the same reason.
   */
  private async tableExists(db: IDatabaseManager, table: string): Promise<boolean> {
    let present = false;

    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        present = SiteOwnedDataMigration.hasRowV48(await db.execute(sql.raw(
          `SELECT 1 AS present FROM information_schema.tables WHERE table_name = '${table}'`,
        )));
      },
      sqlite: async () => {
        present = SiteOwnedDataMigration.hasRowV48(await db.execute(sql.raw(
          `SELECT 1 AS present FROM sqlite_master WHERE type='table' AND name='${table}'`,
        )));
      },
      mysql: async () => {
        // Scoped to this schema — `information_schema` spans every database on the server.
        present = SiteOwnedDataMigration.hasRowV48(await db.execute(sql.raw(
          `SELECT 1 AS present FROM information_schema.tables `
          + `WHERE table_schema = DATABASE() AND table_name = '${table}'`,
        )));
      },
    });

    return present;
  }


  /** A driver returns either an array of rows or an object carrying them; both mean the same thing. */
  private static hasRowV48(result: any): boolean {
    const rows: any[] = Array.isArray(result) ? result : (result?.rows ?? []);
    return rows.length > 0;
  }

  private static readonly loggerV49 = new Logger({ namespace: 'SiteOwnedDataMigration' });


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
    const { loggerV49: logger } = SiteOwnedDataMigration;

    const candidates = await SiteOwnedDataMigration.widenable(db);

    // READ BEFORE DROPPING. Four of the five cascade on delete and one nulls the reference, and
    // rebuilding them without that silently turns "deleting a person removes their addresses" into
    // "deleting a person is refused". Taken from the catalog rather than written down here, so a
    // deployment that chose different actions keeps its own.
    const actions = await SiteOwnedDataMigration.referentialActions(db);

    if (!candidates.length) {
      logger.info('Every tenant-scoped table already keys on (tenant_id, id); nothing to widen.');
      await SiteOwnedDataMigration.restoreForeignKeys(db, actions);
      return;
    }

    // The five composite references are dropped first and rebuilt last: a foreign key pins the unique
    // constraint it points at, so the parent's key cannot be replaced while they hold it.
    for (const key of SiteOwnedDataMigration.COMPOSITE_KEYS) {
      if (!(await SiteOwnedDataMigration.tableExistsV49(db, key.child))) continue;
      await db.execute(sql.raw(`ALTER TABLE ${key.child} DROP CONSTRAINT IF EXISTS ${key.constraint}`));
    }

    const widened: string[] = [];
    const refused = new Map<string, string>();
    for (const table of candidates) {
      const reason = await SiteOwnedDataMigration.widenOne(db, table);
      if (reason) refused.set(table, reason); else widened.push(table);
    }

    await SiteOwnedDataMigration.restoreForeignKeys(db, actions);

    logger.info(`Widened ${widened.length} table(s) to (tenant_id, id); an import can now keep its own ids.`);
    if (refused.size) SiteOwnedDataMigration.reportRefused(refused);
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
      const constraint = await SiteOwnedDataMigration.primaryKeyName(db, table);
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
    SiteOwnedDataMigration.loggerV49.warn(
      `${refused.size} table(s) did NOT get their own id space and keep the shared key: `
      + `${[...refused].map(([table, why]) => `${table} (${why})`).join('; ')}. `
      + 'An import still renumbers those, which is correct but is the expensive path. The usual cause '
      + 'is rows with no owner, which cannot be keyed on — give them an owner and re-running completes it.',
    );
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
    const perTenant = new Set(await SiteOwnedDataMigration.widened(db));

    for (const key of SiteOwnedDataMigration.COMPOSITE_KEYS) {
      if (!(await SiteOwnedDataMigration.tableExistsV49(db, key.child))) continue;
      if (!(await SiteOwnedDataMigration.tableExistsV49(db, key.parent))) continue;

      const composite = perTenant.has(key.parent) && await SiteOwnedDataMigration.hasTenantColumn(db, key.child);
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
    const names = SiteOwnedDataMigration.COMPOSITE_KEYS.map((key) => `'${key.constraint}'`).join(', ');

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


  private static async tableExistsV49(db: IDatabaseManager, table: string): Promise<boolean> {
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
    return SiteOwnedDataMigration.tablesKeyedOn(db, 1);
  }


  /** The same set, already widened — used by the rollback to find what to narrow. */
  private static async widened(db: IDatabaseManager): Promise<string[]> {
    return SiteOwnedDataMigration.tablesKeyedOn(db, 2);
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
    for (const table of await SiteOwnedDataMigration.widened(db)) {
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

  private static readonly loggerV50 = new Logger({ namespace: 'SiteOwnedDataMigration' });


  /**
   * What each reference does when its parent row is deleted — the values every deployment of this
   * platform has had since the tables were created, and the ones 049 briefly discarded.
   *
   * Written down HERE, unlike in 049, because there is nothing left to read them from: on an affected
   * database the action is already gone. This is a repair to a known state, not a general rule.
   */
  private static readonly EXPECTED = [
    { constraint: 'media_folder_id_fkey', child: 'media', column: 'folder_id', parent: 'media_folders', action: 'SET NULL' },
    { constraint: 'media_folders_parent_id_fkey', child: 'media_folders', column: 'parent_id', parent: 'media_folders', action: 'CASCADE' },
    { constraint: 'people_addresses_person_id_fkey', child: 'people_addresses', column: 'person_id', parent: 'people', action: 'CASCADE' },
    { constraint: 'person_relationships_to_person_id_fkey', child: 'person_relationships', column: 'to_person_id', parent: 'people', action: 'CASCADE' },
    { constraint: 'person_relationships_from_person_id_fkey', child: 'person_relationships', column: 'from_person_id', parent: 'people', action: 'CASCADE' },
  ] as const;


  private static async restore(db: IDatabaseManager): Promise<void> {
    const { loggerV50: logger } = SiteOwnedDataMigration;
    const repaired: string[] = [];

    for (const ref of SiteOwnedDataMigration.EXPECTED) {
      const present = await SiteOwnedDataMigration.current(db, ref.constraint);

      // Absent entirely (this deployment has not run 049, or does not have these tables) or already
      // carrying an action — either way there is nothing to repair.
      if (present === null || present !== 'a') continue;

      // The parent may or may not have been widened, so the reference is rebuilt in the shape it is
      // already in — read from the catalog — with only the missing action added.
      const columns = await SiteOwnedDataMigration.keyColumns(db, ref.constraint);
      await db.execute(sql.raw(
        `ALTER TABLE ${ref.child} DROP CONSTRAINT ${ref.constraint}, `
        + `ADD CONSTRAINT ${ref.constraint} FOREIGN KEY (${columns.child}) `
        + `REFERENCES ${ref.parent} (${columns.parent}) ON DELETE ${ref.action}`,
      ));
      repaired.push(`${ref.constraint} (ON DELETE ${ref.action})`);
    }

    if (!repaired.length) {
      logger.info('Every reference already says what it does on delete; nothing to repair.');
      return;
    }

    logger.warn(
      `Restored the delete behaviour of ${repaired.length} reference(s): ${repaired.join(', ')}. `
      + 'They had been rebuilt without it, which turned a cascading delete into a refusal.',
    );
  }


  /**
   * The constraint's delete action as Postgres records it, or `null` when the constraint is not there.
   *
   * `'a'` is NO ACTION, which is what a reference rebuilt bare ends up with — and what this repairs.
   */
  private static async current(db: IDatabaseManager, constraint: string): Promise<string | null> {
    const rows = await db.queryRaw(
      `SELECT confdeltype::text AS del FROM pg_constraint WHERE contype = 'f' AND conname = '${constraint}' LIMIT 1`,
    );
    return rows.length ? String(rows[0].del) : null;
  }


  /**
   * The columns the reference is currently written over, on both sides.
   *
   * Read rather than assumed: whether it is `(folder_id) -> (id)` or `(tenant_id, folder_id) ->
   * (tenant_id, id)` depends on whether 049 widened that parent, which depends on the database.
   */
  private static async keyColumns(db: IDatabaseManager, constraint: string): Promise<{ child: string; parent: string }> {
    const rows = await db.queryRaw(
      `SELECT
         (SELECT string_agg(a.attname, ', ' ORDER BY x.ord)
            FROM unnest(c.conkey) WITH ORDINALITY AS x(att, ord)
            JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = x.att) AS child,
         (SELECT string_agg(a.attname, ', ' ORDER BY x.ord)
            FROM unnest(c.confkey) WITH ORDINALITY AS x(att, ord)
            JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = x.att) AS parent
       FROM pg_constraint c WHERE c.contype = 'f' AND c.conname = '${constraint}' LIMIT 1`,
    );
    return { child: String(rows[0]?.child ?? ''), parent: String(rows[0]?.parent ?? '') };
  }

  /**
   * A theme or plugin can now belong to ONE SITE, instead of always belonging to the platform.
   *
   * Until now installation was a platform act by definition — one container, one `themes/` directory,
   * one copy of each artifact's files, and a site chose among what the operator had installed. That is
   * exactly what 025 said when it declined to put a `tenant_id` on these tables, and the reasoning it
   * gave is still right: one row per slug means two tenants could never both ACTIVATE the same theme.
   *
   * `owner_tenant_id` does not reopen that. It is not "which tenant uses this" — that question is still
   * answered per tenant by `_system_tenant_themes` / `_system_tenant_plugins`, one row each. It is
   * "whose artifact IS this", which has exactly one answer:
   *
   *   NULL          the platform's. Installed by the operator, offered to any site. Every existing row.
   *   <tenant id>   uploaded by that site. Visible, servable and activatable by that site ALONE —
   *                 platform admin included, the same rule the admin listings enforce.
   *
   * Kept nullable with NO default and NO backfill, deliberately. A default would have to be a real
   * tenant id, and there is no honest one to pick; `NULL` already means what every existing row means.
   * Nothing changes meaning when this runs.
   *
   * THE SLUG STAYS GLOBALLY UNIQUE. These tables remain one row per slug, because about ten registries
   * are keyed on it — the in-memory theme and plugin maps, the guest process id `plugin-<slug>`, the
   * writable directory `data/plugins/<slug>`, a plugin's own `fcp_<slug>_*` tables, its route mounts and
   * its asset URLs. So this column does not let two sites both own a `reviews`; it lets the upload path
   * REFUSE the second one with a 409, and say who has it. Namespacing the slug per tenant was the
   * alternative and it is worse: a built artifact refers to its own slug, so rewriting its identity at
   * install time breaks the thing being installed.
   */
  private async v045TenantOwnedArtifacts(db: IDatabaseManager): Promise<void> {
    const { COLUMN, TABLES, logger } = SiteOwnedDataMigration;

    for (const table of TABLES) {
      if (await this.hasOwnerColumn(db, table)) {
        logger.info(`${table}.${COLUMN} already existed; leaving every artifact's owner as it is.`);
        continue;
      }

      // SQLite has neither `information_schema` nor `IF NOT EXISTS` on ADD COLUMN, so presence is
      // asked first rather than leaned on as a clause, and each dialect adds the column in its own
      // words.
      await DialectHelper.executeForDialect(db.dialect, {
        postgres: async () => {
          await db.execute(sql.raw(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${COLUMN} TEXT`));
        },
        sqlite: async () => {
          await db.execute(sql.raw(`ALTER TABLE ${table} ADD COLUMN ${COLUMN} TEXT`));
        },
        mysql: async () => {
          // Bounded rather than TEXT: a tenant id is short and is compared by value, never searched.
          await db.execute(sql.raw(`ALTER TABLE ${table} ADD COLUMN ${COLUMN} VARCHAR(190) NULL`));
        },
      });

      // Indexed because it is a FILTER on every listing, not a lookup key: "the platform's, plus this
      // site's own" is asked on each read of these tables once ownership gating is in.
      await DialectHelper.executeForDialect(db.dialect, {
        postgres: async () => {
          await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS ${table}_${COLUMN}_idx ON ${table} (${COLUMN})`));
        },
        sqlite: async () => {
          await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS ${table}_${COLUMN}_idx ON ${table} (${COLUMN})`));
        },
        mysql: async () => {
          await db.execute(sql.raw(`CREATE INDEX ${table}_${COLUMN}_idx ON ${table} (${COLUMN})`));
        },
      });

      logger.info(
        `${table}.${COLUMN} added, NULL for every existing row — they stay the platform's and every `
        + 'site goes on choosing among them. A non-null owner means an artifact one site uploaded, '
        + 'which only that site may see, serve or activate.',
      );
    }
  }


  /**
   * A role can say which plugin created it.
   *
   * `_system_roles` is global, and deliberately so: `admin` and `editor` are the platform's own
   * vocabulary, and a role that existed per site could not be granted by a framework that resolves
   * identity before it resolves tenancy. That stays.
   *
   * What was missing is ATTRIBUTION. Plugins declare roles through `context.roles.ensure`, and once
   * created those slugs were indistinguishable from the framework's own. So a site's Roles screen
   * listed a role belonging to an extension that site does not run — a name it has no way to interpret
   * — and offered it in the role picker on its Users page. The screen could not filter them because
   * nothing recorded whose they were.
   *
   * NULLABLE, WITH NO BACKFILL, and that is the interesting part. There is no honest way to guess which
   * plugin created a role that already exists — the slug is not a reliable clue, and inventing one would
   * hide a framework role or expose a plugin's. `NULL` therefore means "unattributed", and unattributed
   * roles stay VISIBLE, because hiding a role nobody can account for would be the worse failure: an
   * operator would lose `admin` from a screen with no way to discover why.
   *
   * Existing rows heal themselves instead. `ensure` stamps the column when it finds a row of its own
   * that carries no attribution yet, so the first boot after a plugin is installed records the truth
   * from the plugin that actually declares the role, rather than from a migration's guess.
   */
  private async v046RoleRecordsItsPlugin(db: IDatabaseManager): Promise<void> {
    const { TABLE, COLUMN_V46: COLUMN, loggerV46: logger } = SiteOwnedDataMigration;

    if (await this.hasColumn(db, TABLE, COLUMN)) {
      logger.info(`${TABLE}.${COLUMN} already existed; leaving every role's attribution as it is.`);
      return;
    }

    // SQLite has neither `information_schema` nor `IF NOT EXISTS` on ADD COLUMN, so presence is asked
    // first rather than leaned on as a clause.
    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        await db.execute(sql.raw(`ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS ${COLUMN} TEXT`));
      },
      sqlite: async () => {
        await db.execute(sql.raw(`ALTER TABLE ${TABLE} ADD COLUMN ${COLUMN} TEXT`));
      },
      mysql: async () => {
        await db.execute(sql.raw(`ALTER TABLE ${TABLE} ADD COLUMN ${COLUMN} VARCHAR(190) NULL`));
      },
    });

    logger.info(
      `${TABLE}.${COLUMN} added, NULL for every existing role. An unattributed role stays visible to `
      + 'every site; `context.roles.ensure` stamps the column as each plugin re-declares its own.',
    );
  }


  /**
   * Keeps the old id → new id map an import builds, instead of discarding it when the import ends.
   *
   * `TenantIdRemap` already knows every id it reassigned — the executor holds one for the run and
   * `TenantRowInserter` rewrites each reference through it. Then the import returns and the map is
   * garbage. Nothing else ever sees it.
   *
   * That is affordable only while the reference catalog is complete, and twice it was not: a pointer
   * whose target table is named by a sibling column, and an id declared inside a `json` document, were
   * both invisible to the walk. Every row holding one kept a number that now belongs to a different
   * site's record. Neither bug could be repaired from the platform, because the one thing needed to
   * repair it — which old id became which new id — no longer existed anywhere.
   *
   * What was done instead is the argument for this table. The mapping was RECONSTRUCTED for one
   * tenant, out of band: match each archived row to its imported row on a natural key and `created_at`,
   * confirm the pair twice, emit 22,000 lines of literal SQL, rehearse it against a copy, and run it by
   * hand against production. It worked, and it is not a thing anyone should have to do again — it only
   * worked because those collections happened to carry natural keys, and a table without one could not
   * have been repaired at all.
   *
   * So the map is persisted per import. A reference missed by the catalog can then be re-pointed later
   * by replaying what the importer actually did, derived from the import rather than reconstructed
   * from guesses about it.
   *
   * SINCE MIGRATION 049 this covers much less ground, and that is the point. Most tables now key on
   * `(tenant_id, id)`, so an import keeps its ids and there is no map to record — `TenantIdRemapStore`
   * skips a table in "preserve" mode entirely. What remains is the tables 049 does not widen, which
   * still share one pool of numbers and still renumber when the ranges overlap. Those are exactly the
   * ones a missed reference could still strand, so they are exactly the ones worth recording.
   *
   * NOT a general audit log. It answers exactly one question — "this row says 7; which row is that
   * now?" — and it is scoped, indexed and pruned for that. `imported_at` carries the run so a tenant
   * imported twice keeps both answers in order, most recent last.
   */
  private async v048TenantImportRemap(db: IDatabaseManager): Promise<void> {
    const { TABLE_V48: TABLE, loggerV48: logger } = SiteOwnedDataMigration;

    if (await this.tableExists(db, TABLE)) {
      logger.info(`${TABLE} already existed; leaving every recorded mapping as it is.`);
      return;
    }

    // `old_id` and `new_id` are TEXT in every dialect even though ids are usually integers: a
    // collection may key on a uuid or a slug, and the remap itself stores strings for that reason
    // (`TenantIdRemap` maps String to String). Widening later would mean rewriting rows; starting
    // wide costs nothing here, because these columns are compared for equality and never summed.
    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        await db.execute(sql.raw(`
          CREATE TABLE IF NOT EXISTS ${TABLE} (
            tenant_id    TEXT        NOT NULL,
            table_name   TEXT        NOT NULL,
            old_id       TEXT        NOT NULL,
            new_id       TEXT        NOT NULL,
            imported_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )`));
      },
      sqlite: async () => {
        await db.execute(sql.raw(`
          CREATE TABLE IF NOT EXISTS ${TABLE} (
            tenant_id    TEXT NOT NULL,
            table_name   TEXT NOT NULL,
            old_id       TEXT NOT NULL,
            new_id       TEXT NOT NULL,
            imported_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )`));
      },
      mysql: async () => {
        await db.execute(sql.raw(`
          CREATE TABLE IF NOT EXISTS ${TABLE} (
            tenant_id    VARCHAR(190) NOT NULL,
            table_name   VARCHAR(190) NOT NULL,
            old_id       VARCHAR(190) NOT NULL,
            new_id       VARCHAR(190) NOT NULL,
            imported_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
          )`));
      },
    });

    // The only question this table is asked: "for this tenant and table, what did `old_id` become?"
    // Not unique — a tenant imported twice holds both runs, and `imported_at` orders them.
    await db.execute(sql.raw(
      `CREATE INDEX IF NOT EXISTS idx_${TABLE}_lookup ON ${TABLE} (tenant_id, table_name, old_id)`,
    ));

    logger.info(`${TABLE} created; imports from here on keep the map they build.`);
  }


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
  private async v049PerTenantIdSpace(db: IDatabaseManager): Promise<void> {
    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => SiteOwnedDataMigration.widenAll(db),

      // SQLite cannot alter a primary key — it would mean rebuilding every table — and it is
      // single-site by definition here (no row-level security, so no second site to collide with).
      // There is nothing for this migration to fix there.
      sqlite: async () => {
        SiteOwnedDataMigration.loggerV49.info('SQLite is single-site, so ids never collide across sites; nothing to widen.');
      },

      // MySQL has no row-level security either, so it is single-site for the same reason.
      mysql: async () => {
        SiteOwnedDataMigration.loggerV49.info('MySQL is single-site here, so ids never collide across sites; nothing to widen.');
      },
    });
  }


  /**
   * Puts back the ON DELETE actions that an earlier version of migration 049 dropped.
   *
   * 049 rebuilds five references so they can point at a widened key. For a short window it rebuilt them
   * BARE — reading `pg_get_constraintdef` and writing a plain `FOREIGN KEY ... REFERENCES ...` — which
   * silently removed what each one does when its parent row goes away. Four cascade and one nulls the
   * reference, so on a database that ran that version, deleting a person stopped removing their
   * addresses and started being REFUSED, and deleting a media folder stopped unfiling its media.
   *
   * 049 no longer does that: it reads the actions from the catalog before dropping and re-applies them.
   * But a database that already ran the earlier version has 049 recorded and will never re-run it, so
   * the repair has to be its own migration. This is that repair, and it belongs in the repository rather
   * than in a command somebody remembers to run, because the broken version reached `main`.
   *
   * IDEMPOTENT AND SELF-LIMITING. It only touches a reference whose action is missing, so on any
   * deployment that ran the corrected 049 — or has not run 049 at all — it finds nothing and does
   * nothing. It never removes an action and never changes one that is already set, so a deployment that
   * deliberately chose different actions keeps them.
   */
  private async v050RestoreReferenceActions(db: IDatabaseManager): Promise<void> {
    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => SiteOwnedDataMigration.restore(db),

      // Neither dialect runs the migration this repairs: 049 is a no-op on both, so there is nothing
      // here that could have lost an action.
      sqlite: async () => undefined,
      mysql: async () => undefined,
    });
  }

}

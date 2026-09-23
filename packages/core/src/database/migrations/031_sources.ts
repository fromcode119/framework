import { ColumnGuard } from '@core/database/helpers/column-guard';
import { DialectHelper } from '@core/database/helpers/dialect';
import { Logger } from '@core/logging';
import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';

/**
 * Sources — the repositories an installation builds extensions from — as framework-owned platform
 * configuration.
 *
 * One table of build sources, identified by (type, slug) because a plugin, a theme and an appearance
 * may share a slug; each records the provider that fetches it and whether a successful build installs
 * itself. It is `_system_`-prefixed, so it is platform configuration and never a site's data.
 *
 * Versions 31–38 consolidated. A database that ran them has all eight recorded and runs nothing here.
 * The steps that only carried an older installation's rows forward (renaming its table and plugin
 * registration, then removing that registration) found nothing on a fresh install and are gone; the
 * table is still created and then renamed, so its key and sequence carry the same names on every
 * installation.
 */
export class SourcesMigration extends BaseMigration {
  readonly version = 31;
  readonly name = 'Sources: build sources as platform configuration';

  async up(db: IDatabaseManager): Promise<void> {
    await this.v032SourcesTable(db);
    await this.v034SourcesProviderColumn(db);
    await this.v035SourcesInstallAfterBuild(db);
    await this.v036SourcesIsPlatformConfiguration(db);
    await this.v037SourcesTypeSlugIdentity(db);
    await this.v038SourcesDropPermalinkColumns(db);
  }

  private static readonly TABLE = 'fcp_sources_builds';


  /**
   * One shape, three dialects — created under its old name and renamed below, so its key and sequence
   * carry the same names as on every installation that migrated here step by step.
   *
   * `slug` alone is NOT unique: a plugin, a theme and an appearance may share one, and the identity is
   * the (type, slug) index added below. Created that way from the start, because SQLite cannot drop an
   * inline UNIQUE without rebuilding the table. There are no permalink columns either — a build source
   * has no permalink.
   */
  private static createStatement(idColumn: string, timestamp: string, key: string = 'TEXT'): string {
    return `CREATE TABLE IF NOT EXISTS ${SourcesMigration.TABLE} (
      id ${idColumn},
      created_at ${timestamp} DEFAULT CURRENT_TIMESTAMP,
      updated_at ${timestamp} DEFAULT CURRENT_TIMESTAMP,
      slug ${key} NOT NULL,
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
      auto_build BOOLEAN DEFAULT FALSE,
      auto_update BOOLEAN DEFAULT FALSE,
      changelog TEXT
    )`;
  }

  private static readonly TABLE_V34 = 'fcp_sources_builds';


  private static readonly TABLE_V35 = 'fcp_sources_builds';


  private static readonly OLD_TABLE = 'fcp_sources_builds';

  private static readonly NEW_TABLE = '_system_sources_builds';

  private static readonly logger = new Logger({ namespace: 'SourcesMigration' });


  /** Returns whether the destination table is now the one to work on. */
  private async moveTable(db: IDatabaseManager): Promise<boolean> {
    const { OLD_TABLE, NEW_TABLE, logger } = SourcesMigration;
    const oldExists = await this.tableExists(db, OLD_TABLE);
    const newExists = await this.tableExists(db, NEW_TABLE);

    if (oldExists && newExists) {
      logger.warn(
        `Both "${OLD_TABLE}" and "${NEW_TABLE}" exist. Leaving the old table untouched: which one `
        + 'holds the real build history is a decision for an operator. Nothing was lost.',
      );
      return false;
    }
    if (!oldExists) return newExists;

    // A rename keeps the rows, the sequence and the indexes; recreating and copying keeps only rows.
    await db.execute(sql.raw(`ALTER TABLE ${OLD_TABLE} RENAME TO ${NEW_TABLE}`));
    logger.info(`Renamed ${OLD_TABLE} -> ${NEW_TABLE}: Sources is platform configuration.`);
    return true;
  }


  /**
   * Takes the table out of tenancy: policies off, row-level security off, `tenant_id` gone.
   *
   * The sweep only ever ADDS isolation, so a table that already carries a policy keeps it however it
   * is named — the rename alone would have left every existing deployment exactly as broken.
   */
  private async releaseFromTenancy(db: IDatabaseManager): Promise<void> {
    const { NEW_TABLE, logger } = SourcesMigration;

    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        await db.execute(sql.raw(`
          DO $$
          DECLARE policy_row record;
          BEGIN
            FOR policy_row IN SELECT policyname FROM pg_policies WHERE tablename = '${NEW_TABLE}'
            LOOP
              EXECUTE format('DROP POLICY %I ON ${NEW_TABLE}', policy_row.policyname);
            END LOOP;
          END $$;
        `));
        await db.execute(sql.raw(`ALTER TABLE ${NEW_TABLE} NO FORCE ROW LEVEL SECURITY`));
        await db.execute(sql.raw(`ALTER TABLE ${NEW_TABLE} DISABLE ROW LEVEL SECURITY`));
        // Dropping the column takes its index and its default with it. The default was what stamped
        // each row with whichever site happened to be in scope when an operator added a source.
        await db.execute(sql.raw(`ALTER TABLE ${NEW_TABLE} DROP COLUMN IF EXISTS tenant_id`));
      },
      sqlite: async () => {
        // SQLite has no row-level security, so there is nothing to release — and dropping a column
        // there rewrites the table, which is not worth doing for a column nothing reads.
      },
      mysql: async () => {
        // Migration 032's MySQL branch never added row-level security or a tenant_id column to this
        // table in the first place (MySQL has neither), so there is nothing to release here either.
      },
    });

    logger.info(`${NEW_TABLE} is out of tenancy: every site's admin and the build timer see it again.`);
  }


  /**
   * Asked of the driver, which knows its own catalogue. A hand-written catalogue query read its answer
   * out of `execute`, and the SQLite driver's `execute` returns no rows for a SELECT — so on SQLite
   * every table looked absent and the rename, the (type, slug) identity and the permalink cleanup
   * were all silently skipped.
   */
  private async tableExists(db: IDatabaseManager, table: string): Promise<boolean> {
    return db.tableExists(table);
  }



  private static readonly TABLE_V37 = '_system_sources_builds';

  private static readonly INDEX = 'idx_system_sources_builds_type_slug';

  private static readonly loggerV37 = new Logger({ namespace: 'SourcesMigration' });


  /**
   * Removes any unique whose column set is exactly `(slug)` — constraint or bare index.
   *
   * By catalogue lookup rather than by name: the same logical constraint is called different things
   * depending on which migration created the table and whether it has since been renamed, and a
   * `DROP CONSTRAINT IF EXISTS <guessed name>` that matches nothing fails silently and leaves the
   * old key in place, which is exactly the bug this migration exists to remove.
   */
  private async dropSlugOnlyUniques(db: IDatabaseManager): Promise<void> {
    const { TABLE_V37: TABLE, loggerV37: logger } = SourcesMigration;

    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        await db.execute(sql.raw(`
          DO $$
          DECLARE target record;
          BEGIN
            FOR target IN
              SELECT con.conname AS name
              FROM pg_constraint con
              JOIN pg_class rel ON rel.oid = con.conrelid
              WHERE rel.relname = '${TABLE}'
                AND con.contype = 'u'
                AND (SELECT array_agg(att.attname::text ORDER BY att.attname::text)
                     FROM unnest(con.conkey) AS k(attnum)
                     JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = k.attnum
                    ) = ARRAY['slug']::text[]
            LOOP
              EXECUTE format('ALTER TABLE ${TABLE} DROP CONSTRAINT %I', target.name);
            END LOOP;

            FOR target IN
              SELECT cls.relname AS name
              FROM pg_index idx
              JOIN pg_class cls ON cls.oid = idx.indexrelid
              JOIN pg_class rel ON rel.oid = idx.indrelid
              WHERE rel.relname = '${TABLE}'
                AND idx.indisunique
                AND NOT idx.indisprimary
                AND (SELECT array_agg(att.attname::text ORDER BY att.attname::text)
                     FROM unnest(idx.indkey) AS k(attnum)
                     JOIN pg_attribute att ON att.attrelid = idx.indrelid AND att.attnum = k.attnum
                    ) = ARRAY['slug']::text[]
            LOOP
              EXECUTE format('DROP INDEX %I', target.name);
            END LOOP;
          END $$;
        `));
      },
      sqlite: async () => {
        // An inline column UNIQUE cannot be dropped without rebuilding the table, and both dev and
        // production run Postgres. A SQLite deployment keeps the old key and the composite one
        // alongside it: the second kind is still refused there, and this says so rather than
        // rewriting a table to fix an environment nobody runs.
        logger.warn(
          'SQLite: a slug-only UNIQUE declared inline cannot be dropped without a table rebuild, '
          + 'so a second extension kind with the same slug stays refused on this dialect.',
        );
      },
      mysql: async () => {
        // Unlike SQLite, MySQL can drop an inline UNIQUE with an ordinary ALTER, so this reaches the
        // same outcome as the Postgres branch: find any unique index whose column set is exactly
        // `(slug)` via the catalogue, by columns rather than by name for the same reason the Postgres
        // branch does — the generated name depends on which migration created the table.
        const result = await db.execute(sql.raw(`
          SELECT index_name AS name
          FROM information_schema.STATISTICS
          WHERE table_schema = DATABASE() AND table_name = '${TABLE}'
            AND non_unique = 0 AND index_name <> 'PRIMARY'
          GROUP BY index_name
          HAVING COUNT(*) = 1 AND MAX(column_name) = 'slug'
        `));
        const rows: any[] = Array.isArray(result) ? result : ((result as any)?.rows ?? []);
        for (const row of rows) {
          await db.execute(sql.raw(`ALTER TABLE ${TABLE} DROP INDEX ${row.name}`));
        }
      },
    });
  }


  /** True when rows already share a `(type, slug)` pair, which the new index could not accept. */
  private async hasDuplicatePairs(db: IDatabaseManager): Promise<boolean> {
    const { TABLE_V37: TABLE, loggerV37: logger } = SourcesMigration;
    const result: any = await db.execute(sql.raw(
      `SELECT type, slug, COUNT(*) AS copies FROM ${TABLE} GROUP BY type, slug HAVING COUNT(*) > 1`,
    ));

    const rows: any[] = Array.isArray(result) ? result : (result?.rows ?? []);
    if (rows.length === 0) return false;

    const pairs = rows.map((row) => `${row.type}/${row.slug} (${row.copies})`).join(', ');
    logger.warn(
      `Not adding the unique (type, slug) index: these sources already share a pair — ${pairs}. `
      + 'Nothing was deleted; which row is the real one is an operator decision. Remove the extras '
      + 'in admin and restart, and the index will be created then.',
    );
    return true;
  }


  private async createCompositeIndex(db: IDatabaseManager): Promise<void> {
    const { TABLE_V37: TABLE, INDEX, loggerV37: logger } = SourcesMigration;
    await db.execute(sql.raw(`CREATE UNIQUE INDEX IF NOT EXISTS ${INDEX} ON ${TABLE} (type, slug)`));
    logger.info(`${TABLE} is keyed on (type, slug): one slug can name a plugin, a theme and an appearance.`);
  }





  private static readonly TABLE_V38 = '_system_sources_builds';

  private static readonly COLUMNS = ['custom_permalink', 'disable_permalink'];

  private static readonly loggerV38 = new Logger({ namespace: 'SourcesMigration' });


  /** How many rows would lose something. Empty strings count: they are a value somebody wrote. */
  private async countValues(db: IDatabaseManager): Promise<number> {
    const { TABLE_V38: TABLE, COLUMNS } = SourcesMigration;
    const present = await this.presentColumns(db);
    const conditions = COLUMNS.filter((column) => present.includes(column))
      .map((column) => `(${column} IS NOT NULL AND ${column} <> '' AND ${column} <> 'false')`);
    if (conditions.length === 0) return 0;

    // `queryRaw`, not `execute`: the SQLite driver's `execute` returns no rows for a SELECT.
    const rows = await db.queryRaw(`SELECT COUNT(*) AS carrying FROM ${TABLE} WHERE ${conditions.join(' OR ')}`);
    return Number((rows[0] as { carrying?: unknown } | undefined)?.carrying ?? 0);
  }


  /** Which of the two columns this installation actually has — neither is guaranteed. Asked of the driver. */
  private async presentColumns(db: IDatabaseManager): Promise<string[]> {
    const { TABLE_V38: TABLE, COLUMNS } = SourcesMigration;
    return (await db.getColumns(TABLE)).map((column) => column.toLowerCase()).filter((column) => COLUMNS.includes(column));
  }







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
  private async v032SourcesTable(db: IDatabaseManager): Promise<void> {
    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        await db.execute(sql.raw(SourcesMigration.createStatement('SERIAL PRIMARY KEY', 'TIMESTAMPTZ')));
        // Row-level security, exactly as every other tenant-scoped table gets it. The column, its
        // default, the index, ENABLE + FORCE and the policy all come from the framework's own helper
        // so this table cannot drift from the rest.
        await db.tenantIsolation.isolateTable(SourcesMigration.TABLE);
      },
      sqlite: async () => {
        await db.execute(sql.raw(SourcesMigration.createStatement('INTEGER PRIMARY KEY AUTOINCREMENT', 'TEXT')));
      },
      mysql: async () => {
        // `slug` carries a UNIQUE, `type` joins it in migration 037's composite index, and `branch`,
        // `last_build_status` and `disable_permalink` each carry a DEFAULT — none of those five can
        // be TEXT in MySQL, so they get VARCHAR(191) here.
        await db.execute(sql.raw(
          SourcesMigration.createStatement('INT AUTO_INCREMENT PRIMARY KEY', 'TIMESTAMP NULL', 'VARCHAR(191)'),
        ));
      },
    });
  }


  /**
   * Records WHICH provider fetches each source.
   *
   * Until now the answer was git, everywhere, implicitly — the columns are called `git_url` and
   * `git_secret`, and the code shelled out to `git`. That is not a choice anything recorded; it is an
   * assumption, and an assumption cannot be changed per source.
   *
   * `'git'` as the default is a statement about the existing rows rather than a guess: every source
   * that predates this column was fetched by cloning a repository, because nothing else existed.
   * New rows carry whatever the operator picked.
   *
   * The git-named columns keep their names. Renaming them to `location`/`secret` is the right shape and
   * the wrong migration to bundle here: it would rewrite the table every deployment reads, for a
   * cosmetic gain, in the same release that changes how sources are fetched.
   */
  private async v034SourcesProviderColumn(db: IDatabaseManager): Promise<void> {
    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        await ColumnGuard.addIfMissing(db, SourcesMigration.TABLE_V34, 'provider', "TEXT DEFAULT 'git'");
      },
      sqlite: async () => {
        await ColumnGuard.addIfMissing(db, SourcesMigration.TABLE_V34, 'provider', "TEXT DEFAULT 'git'");
      },
      // TEXT cannot carry a DEFAULT in MySQL; VARCHAR(191) is plenty for a provider name.
      mysql: async () => {
        await ColumnGuard.addIfMissing(db, SourcesMigration.TABLE_V34, 'provider', "VARCHAR(191) DEFAULT 'git'");
      },
    });
    // The default only applies to rows written after it exists, so existing ones are stated too —
    // a NULL provider would read as "unknown", and the build refuses an unknown provider by design.
    await db.execute(sql.raw(
      `UPDATE ${SourcesMigration.TABLE_V34} SET provider = 'git' WHERE provider IS NULL OR provider = ''`,
    ));
  }

  /**
   * A build can install what it produced, and updating something already running is a separate yes.
   *
   * Before this column there was no way to say "put it in place" at all. `auto_update` was the only
   * install switch, it ran only on the scheduled path, and the admin forced it off unless automatic
   * building was on — so pressing Build produced a package and left it in the workspace. The button
   * did half a job and nothing said which half.
   *
   * The two are now different questions. `install_after_build` covers putting a package where none is
   * installed, which is additive; `auto_update` covers REPLACING code that is currently serving a
   * site, which is not, and keeps its own switch for that reason. Neither depends on `auto_build`.
   *
   * TRUE for existing rows as well as new ones, stated rather than left to the column default: a
   * default applies only to rows written after it exists, and an operator who added a source to have
   * it built meant for the result to arrive. Same reasoning as migration 034's `provider` backfill.
   */
  private async v035SourcesInstallAfterBuild(db: IDatabaseManager): Promise<void> {
    await ColumnGuard.addIfMissing(
      db,
      SourcesMigration.TABLE_V35,
      'install_after_build',
      'BOOLEAN DEFAULT TRUE',
    );
    await db.execute(sql.raw(
      `UPDATE ${SourcesMigration.TABLE_V35} SET install_after_build = TRUE WHERE install_after_build IS NULL`,
    ));
  }

  /**
   * Sources is platform configuration, and its table stops pretending to be a tenant's.
   *
   * Which repositories an installation builds is not a site's content — it is what the OPERATOR has
   * pointed the platform at. But the table was still named `fcp_<slug>_*` from when Sources was a
   * plugin, and tenant scoping is derived from the NAME: anything not starting with `_system_` is
   * treated as tenant data and swept under row-level security on every boot.
   *
   * Measured on a nine-tenant deployment before this migration, querying as the app role:
   *
   *   the auto-build timer (no tenant)   0 sources visible
   *   the site that created it           1
   *   every other site's admin           0
   *
   * So the Sources screen was empty for every site but one, and the scheduled build — which runs
   * outside any request — saw nothing and therefore never built anything. Rows created before the
   * sweep carry `tenant_id = NULL`, which matches no site at all, so on a single-tenant installation
   * the whole list would vanish the day a second site was added.
   *
   * The fix is the name, because the name is the rule. `_system_sources_builds` is excluded by the
   * same derivation that was scoping it, so no exception list is introduced and nothing has to
   * remember this table exists. The policy and the column go with it: leaving `tenant_id` behind would
   * let the export/adoption catalogue, which finds tables BY that column, pick this one up again.
   *
   * Idempotent and conditional throughout, and it never writes over data already at the destination —
   * if both tables exist the old one is left alone and reported, exactly as migration 031 decided,
   * because which history is real is an operator's call.
   */
  private async v036SourcesIsPlatformConfiguration(db: IDatabaseManager): Promise<void> {
    const moved = await this.moveTable(db);
    if (!moved) return;
    await this.releaseFromTenancy(db);
  }


  /**
   * A build source is identified by its KIND and its slug, not by its slug alone.
   *
   * `acme` the plugin, `acme` the theme and `acme` the appearance are three different
   * extensions. They clone into three different directories, stage into three different roots and
   * install through three different validators — the disk layout has always known this. Only the
   * table did not, so adding the second one failed with "a build source with slug acme already
   * exists", and the operator was told to rename an extension to work around a missing index.
   *
   * Two shapes exist in the wild and this handles both. A table created by migration 032 declares
   * `slug TEXT NOT NULL UNIQUE`, so it carries a single-column unique (its generated name survived
   * 036's rename and is therefore still the OLD table's name — which is why the constraint is found
   * by its COLUMNS here, never by its name). A table that predates 032 has no unique at all; there,
   * the only thing that ever enforced uniqueness was a check in the service, and a slug-only
   * `update(table, { slug }, …)` would have written every row that shared the slug.
   *
   * A pre-existing duplicate pair is reported and the index is skipped, following 031 and 036: which
   * of two rows is the real one is an operator's decision, and a migration that throws here would
   * refuse to boot the whole platform over it. The service's own guard still refuses to create one,
   * so the gap cannot widen while it is open.
   */
  private async v037SourcesTypeSlugIdentity(db: IDatabaseManager): Promise<void> {
    if (!(await this.tableExists(db, SourcesMigration.TABLE_V37))) return;

    await this.dropSlugOnlyUniques(db);
    if (await this.hasDuplicatePairs(db)) return;
    await this.createCompositeIndex(db);
  }


  /**
   * A build source has no permalink, and stops carrying two columns that said it might.
   *
   * `custom_permalink` and `disable_permalink` are residue from when Sources was a plugin. The
   * framework injects that pair into every plugin-registered collection, and `custom_permalink` is
   * declared `unique: true` — so the schema manager built a real unique constraint on it. Sources
   * stopped being a plugin (its table is `_system_` now, outside that machinery entirely), and
   * `ensurePermalinkFields` has since been narrowed to collections the admin actually shows a
   * permalink panel for. Nothing recreates these.
   *
   * Nothing reads them either, and nothing ever wrote one: a column an operator cannot see or change,
   * feeding nothing, is the thing this codebase is not allowed to have. Counted before removing —
   * 0 of 21 rows on the deployed installation and 0 of 1 locally carry any value in either column, so
   * this deletes no data.
   *
   * The unique constraint is the part with teeth. It was `UNIQUE` over a single nullable column, which
   * Postgres is happy to let repeat while the value is NULL — every row today. The first two sources
   * ever written with an EMPTY STRING rather than a NULL would collide, and the failure would surface
   * as an insert refused on a column nobody knew existed.
   *
   * Dropping a column takes its constraints and indexes with it, so there is nothing to drop by name —
   * which matters, because the constraint is still called `fcp_build_server_builds_custom_permalink_key`
   * after two renames of the table it belongs to.
   */
  private async v038SourcesDropPermalinkColumns(db: IDatabaseManager): Promise<void> {
    const { TABLE_V38: TABLE, COLUMNS, loggerV38: logger } = SourcesMigration;
    if (!(await this.tableExists(db, SourcesMigration.TABLE_V38))) return;

    const carrying = await this.countValues(db);
    if (carrying > 0) {
      // Refusing to delete something nobody can explain. The columns stay, the constraint stays, and
      // an operator decides — exactly as migrations 031, 036 and 037 do when the data surprises them.
      logger.warn(
        `Leaving ${COLUMNS.join(' and ')} on ${TABLE}: ${carrying} row(s) carry a value, which nothing `
        + 'in this codebase writes. Nothing was deleted; work out where those came from first.',
      );
      return;
    }

    // Only the columns that are there, dropped plainly: `DROP COLUMN IF EXISTS` is not SQLite (or MySQL).
    for (const column of await this.presentColumns(db)) {
      await db.execute(sql.raw(`ALTER TABLE ${TABLE} DROP COLUMN ${column}`));
    }

    logger.info(`${TABLE} no longer carries permalink columns, or the unique constraint one of them held.`);
  }

}

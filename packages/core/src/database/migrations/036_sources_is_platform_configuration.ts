import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';
import { DialectHelper } from '../helpers/dialect';
import { Logger } from '../../logging';

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
export class SourcesIsPlatformConfigurationMigration extends BaseMigration {
  readonly version = 36;
  readonly name = 'Sources is platform configuration, not tenant data';

  private static readonly OLD_TABLE = 'fcp_sources_builds';
  private static readonly NEW_TABLE = '_system_sources_builds';
  private static readonly logger = new Logger({ namespace: 'SourcesIsPlatformConfigurationMigration' });

  async up(db: IDatabaseManager): Promise<void> {
    const moved = await this.moveTable(db);
    if (!moved) return;
    await this.releaseFromTenancy(db);
  }

  /** Returns whether the destination table is now the one to work on. */
  private async moveTable(db: IDatabaseManager): Promise<boolean> {
    const { OLD_TABLE, NEW_TABLE, logger } = SourcesIsPlatformConfigurationMigration;
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
    const { NEW_TABLE, logger } = SourcesIsPlatformConfigurationMigration;

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
    });

    logger.info(`${NEW_TABLE} is out of tenancy: every site's admin and the build timer see it again.`);
  }

  /** Asking whether a table exists is the one thing with no portable spelling. */
  private async tableExists(db: IDatabaseManager, table: string): Promise<boolean> {
    let present = false;
    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        present = SourcesIsPlatformConfigurationMigration.hasRow(
          await db.execute(sql.raw(`SELECT 1 AS present FROM pg_class WHERE relname = '${table}'`)),
        );
      },
      sqlite: async () => {
        present = SourcesIsPlatformConfigurationMigration.hasRow(
          await db.execute(sql.raw(`SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = '${table}'`)),
        );
      },
    });
    return present;
  }

  /** Drivers answer either an array or `{ rows }`; both mean the same thing here. */
  private static hasRow(result: unknown): boolean {
    const list = (result as { rows?: unknown[] })?.rows ?? (result as unknown[]);
    return Array.isArray(list) ? list.length > 0 : Boolean(list);
  }
}

import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';
import { DialectHelper } from '../helpers/dialect';
import { Logger } from '../../logging';

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
export class RoleRecordsItsPluginMigration extends BaseMigration {
  readonly version = 46;
  readonly name = 'A role records the plugin that created it';

  private static readonly TABLE = '_system_roles';
  private static readonly COLUMN = 'plugin_slug';
  private static readonly logger = new Logger({ namespace: 'RoleRecordsItsPluginMigration' });

  async up(db: IDatabaseManager): Promise<void> {
    const { TABLE, COLUMN, logger } = RoleRecordsItsPluginMigration;

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

  /** Whether the column is already there. SQLite answers with PRAGMA and errors on information_schema. */
  private async hasColumn(db: IDatabaseManager, table: string, column: string): Promise<boolean> {
    let present = false;

    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        present = RoleRecordsItsPluginMigration.hasRow(await db.execute(sql.raw(
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
        present = RoleRecordsItsPluginMigration.hasRow(await db.execute(sql.raw(
          `SELECT 1 AS present FROM information_schema.columns
            WHERE table_schema = DATABASE() AND table_name = '${table}' AND column_name = '${column}'`,
        )));
      },
    });

    return present;
  }

  private static hasRow(result: any): boolean {
    const rows: any[] = Array.isArray(result) ? result : (result?.rows ?? []);
    return rows.length > 0;
  }
}

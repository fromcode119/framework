import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';
import { DialectHelper } from '../helpers/dialect';
import { Logger } from '../../logging';

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
export class SourcesDropPermalinkColumnsMigration extends BaseMigration {
  readonly version = 38;
  readonly name = 'A build source has no permalink';

  private static readonly TABLE = '_system_sources_builds';
  private static readonly COLUMNS = ['custom_permalink', 'disable_permalink'];
  private static readonly logger = new Logger({ namespace: 'SourcesDropPermalinkColumnsMigration' });

  async up(db: IDatabaseManager): Promise<void> {
    const { TABLE, COLUMNS, logger } = SourcesDropPermalinkColumnsMigration;
    if (!(await this.tableExists(db))) return;

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

    for (const column of COLUMNS) {
      await db.execute(sql.raw(`ALTER TABLE ${TABLE} DROP COLUMN IF EXISTS ${column}`));
    }

    logger.info(`${TABLE} no longer carries permalink columns, or the unique constraint one of them held.`);
  }

  /** How many rows would lose something. Empty strings count: they are a value somebody wrote. */
  private async countValues(db: IDatabaseManager): Promise<number> {
    const { TABLE, COLUMNS } = SourcesDropPermalinkColumnsMigration;
    const present = await this.presentColumns(db);
    const conditions = COLUMNS.filter((column) => present.includes(column))
      .map((column) => `(${column} IS NOT NULL AND ${column} <> '' AND ${column} <> 'false')`);
    if (conditions.length === 0) return 0;

    const result: any = await db.execute(sql.raw(
      `SELECT COUNT(*) AS carrying FROM ${TABLE} WHERE ${conditions.join(' OR ')}`,
    ));
    const rows: any[] = Array.isArray(result) ? result : (result?.rows ?? []);
    return Number(rows[0]?.carrying ?? 0);
  }

  /** Which of the two columns this installation actually has — neither is guaranteed. */
  private async presentColumns(db: IDatabaseManager): Promise<string[]> {
    const { TABLE, COLUMNS } = SourcesDropPermalinkColumnsMigration;
    const quoted = COLUMNS.map((column) => `'${column}'`).join(', ');
    let present: string[] = [];

    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        present = SourcesDropPermalinkColumnsMigration.names(
          await db.execute(sql.raw(
            `SELECT column_name AS name FROM information_schema.columns
             WHERE table_name = '${TABLE}' AND column_name IN (${quoted})`,
          )),
          'name',
        );
      },
      sqlite: async () => {
        present = SourcesDropPermalinkColumnsMigration.names(
          await db.execute(sql.raw(`PRAGMA table_info(${TABLE})`)),
          'name',
        ).filter((name) => COLUMNS.includes(name));
      },
    });

    return present;
  }

  private async tableExists(db: IDatabaseManager): Promise<boolean> {
    const { TABLE } = SourcesDropPermalinkColumnsMigration;
    let present = false;

    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        present = SourcesDropPermalinkColumnsMigration.hasRow(
          await db.execute(sql.raw(`SELECT 1 AS present FROM pg_class WHERE relname = '${TABLE}'`)),
        );
      },
      sqlite: async () => {
        present = SourcesDropPermalinkColumnsMigration.hasRow(
          await db.execute(sql.raw(`SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = '${TABLE}'`)),
        );
      },
    });

    return present;
  }

  private static names(result: unknown, key: string): string[] {
    const rows: any[] = Array.isArray(result) ? result : ((result as any)?.rows ?? []);
    return rows.map((row) => String(row?.[key] ?? '')).filter(Boolean);
  }

  private static hasRow(result: unknown): boolean {
    const rows: any[] = Array.isArray(result) ? result : ((result as any)?.rows ?? []);
    return rows.length > 0;
  }
}

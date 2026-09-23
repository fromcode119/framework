import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';
import { Logger } from '@core/logging';

/**
 * Makes every `timestamp without time zone` column a `timestamp with time zone`.
 *
 * Twenty framework columns — sites, memberships, file shares and grants, notifications, redirects,
 * webhooks — were created without a zone. Their values are right only because every connection runs
 * in UTC; a session in any other timezone would read and write them shifted. A `timestamptz` holds
 * the instant itself.
 *
 * Exact, not an approximation: the values were written in UTC, so each is read AT TIME ZONE 'UTC'.
 * PostgreSQL only — MySQL's DATETIME and SQLite's text have no zone-aware type to move to.
 */
export class TimestampsCarryTheirZoneMigration extends BaseMigration {
  readonly version = 54;
  readonly name = 'Timestamps carry their time zone';

  private static readonly logger = new Logger({ namespace: 'TimestampsCarryTheirZoneMigration' });
  private static readonly IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

  async up(db: IDatabaseManager): Promise<void> {
    if (db.dialect !== 'postgres') return;

    const columns = await db.queryRaw(
      "SELECT table_name, column_name FROM information_schema.columns "
      + "WHERE table_schema = current_schema() AND data_type = 'timestamp without time zone' "
      + 'ORDER BY table_name, column_name',
    );
    for (const row of columns) {
      const table = String(row.table_name);
      const column = String(row.column_name);
      if (!TimestampsCarryTheirZoneMigration.IDENTIFIER.test(table) || !TimestampsCarryTheirZoneMigration.IDENTIFIER.test(column)) {
        TimestampsCarryTheirZoneMigration.logger.warn(`Skipped ${table}.${column}: not a plain identifier.`);
        continue;
      }
      await db.execute(sql.raw(
        `ALTER TABLE "${table}" ALTER COLUMN "${column}" TYPE TIMESTAMP WITH TIME ZONE USING "${column}" AT TIME ZONE 'UTC'`,
      ));
      TimestampsCarryTheirZoneMigration.logger.info(`${table}.${column} now carries its time zone.`);
    }
  }
}

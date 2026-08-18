import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';
import { DialectHelper } from '@core/database/helpers/dialect';

/**
 * Removes page-view rows that were written twice for a single view.
 *
 * The landing page resolved its token twice per load, so one person opening a share once produced two
 * identical log rows. Measured before the write path was fixed: 10 opens, 20 rows. Every count derived
 * from this table — "opened", the per-share badges, the activity screen — was therefore double.
 *
 * This is a deletion, so it is deliberately the narrowest one that fixes the problem:
 *
 *  - VIEWS ONLY (`media_id IS NULL`). A download is a deliberate act that also spends the recipient's
 *    allowance, so two downloads a second apart are two real events and are never touched.
 *  - Identical `grant_id`, `ip`, `outcome` AND `created_at` to the second. Anything that differs in any
 *    of those is a different event and survives.
 *  - The LOWEST id in each group is kept, so the original row and its timestamp remain.
 *
 * It cannot remove a genuinely distinct event unless two real views happened in the same second, from
 * the same address, for the same grant — which is indistinguishable from the bug, and which the write
 * path now collapses anyway. Keeping known-false rows would not make the log more truthful; it would
 * only make it permanently wrong about how many times someone opened their files.
 */
export class FileAccessLogDedupeViewsMigration extends BaseMigration {
  readonly version = 17;
  readonly name = 'Collapse duplicate page-view rows in _system_file_access_log';

  async up(db: IDatabaseManager): Promise<void> {
    // One statement, identical across dialects: delete a view row when an OLDER row exists that agrees
    // on every field that makes an event what it is.
    const statement = `
      DELETE FROM ${FileAccessLogDedupeViewsMigration.TABLE}
      WHERE media_id IS NULL
        AND id NOT IN (
          SELECT MIN(inner_log.id)
          FROM ${FileAccessLogDedupeViewsMigration.TABLE} AS inner_log
          WHERE inner_log.media_id IS NULL
          GROUP BY inner_log.grant_id, inner_log.ip, inner_log.outcome, inner_log.created_at
        )
    `;

    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => { await db.execute(sql.raw(statement)); },
      // MySQL refuses to read the table it is deleting from in a subquery unless it is wrapped, which
      // materialises it into a derived table first.
      mysql: async () => {
        await db.execute(sql.raw(statement.replace(
          /\(\s*SELECT MIN\(inner_log\.id\)[\s\S]*?\)\s*$/m,
          `(SELECT keep_id FROM (
              SELECT MIN(inner_log.id) AS keep_id
              FROM ${FileAccessLogDedupeViewsMigration.TABLE} AS inner_log
              WHERE inner_log.media_id IS NULL
              GROUP BY inner_log.grant_id, inner_log.ip, inner_log.outcome, inner_log.created_at
            ) AS keepers)`,
        )));
      },
      sqlite: async () => { await db.execute(sql.raw(statement)); },
    });
  }

  private static readonly TABLE = '_system_file_access_log';
}

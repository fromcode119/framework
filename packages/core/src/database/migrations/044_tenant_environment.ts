import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';
import { DialectHelper } from '@core/database/helpers/dialect';
import { Logger } from '@core/logging';

/**
 * A site may be a COPY, and a copy must not reach the outside world.
 *
 * Migrating a live shop onto the platform means standing up a staging site that holds the real thing:
 * real customers, real Stripe keys, real courier credentials, real MLM payout config. Nothing stopped
 * it emailing those customers, capturing those cards or booking those shipments — the only switches
 * were `state` (which takes the admin away too) and `visibility` (which only decides who may READ).
 *
 * `environment` is the missing axis: may this site SEND. It is enforced at the framework's own
 * chokepoints — the email driver, `context.fetch`, the scheduler — so a plugin that has never heard
 * of it still cannot send.
 *
 * THE DEFAULT IS `production`, AND SO IS THE BACKFILL. Unlike 039, where the safe direction was to
 * open existing sites explicitly, here the declared default is already the one every existing row
 * needs: they are live and they go on sending. A migration that silently muted a working shop's order
 * confirmations would be the worst possible way to ship a safety feature — and unlike a site going
 * dark, nobody would notice for days.
 */
export class TenantEnvironmentMigration extends BaseMigration {
  readonly version = 44;
  readonly name = 'A site can be marked non-production so nothing leaves it';

  private static readonly TABLE = '_system_tenants';
  private static readonly logger = new Logger({ namespace: 'TenantEnvironmentMigration' });

  async up(db: IDatabaseManager): Promise<void> {
    const { TABLE, logger } = TenantEnvironmentMigration;

    if (await this.hasEnvironmentColumn(db)) {
      logger.info(`${TABLE}.environment already existed; leaving every site's environment as it is.`);
      return;
    }

    // SQLite has neither `information_schema` nor `IF NOT EXISTS` on ADD COLUMN, so the column has to
    // be added in each dialect's own words — which is why presence is asked first rather than leaned
    // on as a clause.
    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        await db.execute(sql.raw(
          `ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS environment TEXT NOT NULL DEFAULT 'production'`,
        ));
      },
      sqlite: async () => {
        await db.execute(sql.raw(
          `ALTER TABLE ${TABLE} ADD COLUMN environment TEXT NOT NULL DEFAULT 'production'`,
        ));
      },
      mysql: async () => {
        // Bounded rather than TEXT: the column is short and compared by value.
        await db.execute(sql.raw(
          `ALTER TABLE ${TABLE} ADD COLUMN environment VARCHAR(32) NOT NULL DEFAULT 'production'`,
        ));
      },
    });

    logger.info(
      `${TABLE}.environment added, default 'production' — every existing site keeps sending. `
      + 'Mark a site non-production to stop email, payments, shipments and scheduled work leaving it.',
    );
  }

  /**
   * Whether the column is already there, asked before adding it.
   *
   * `information_schema` is PostgreSQL's; SQLite answers the same question with `PRAGMA table_info`
   * and errors on the other form, which would take the whole boot down on that driver.
   */
  private async hasEnvironmentColumn(db: IDatabaseManager): Promise<boolean> {
    const { TABLE } = TenantEnvironmentMigration;
    let present = false;

    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        present = TenantEnvironmentMigration.hasRow(await db.execute(sql.raw(
          `SELECT 1 AS present FROM information_schema.columns
            WHERE table_name = '${TABLE}' AND column_name = 'environment'`,
        )));
      },
      sqlite: async () => {
        const result: any = await db.execute(sql.raw(`PRAGMA table_info(${TABLE})`));
        const rows: any[] = Array.isArray(result) ? result : (result?.rows ?? []);
        present = rows.some((row: any) => String(row?.name || '') === 'environment');
      },
      mysql: async () => {
        // Scoped to this schema — `information_schema` spans every database on the server.
        present = TenantEnvironmentMigration.hasRow(await db.execute(sql.raw(
          `SELECT 1 AS present FROM information_schema.columns
            WHERE table_schema = DATABASE() AND table_name = '${TABLE}' AND column_name = 'environment'`,
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

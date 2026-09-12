import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';
import { Logger } from '../../logging';

/**
 * A site is not open to the public until somebody says it is.
 *
 * There was no way to express "still being built". The only switch was `state`, and suspending a
 * site takes its ADMIN away too — the api answers `503 tenant_suspended` on the admin branch as
 * well as the storefront one — so the one control that hid a site also locked the operator out of
 * finishing it. In practice every new site was born public: created, imported, and immediately
 * readable and indexable by anyone who found the host.
 *
 * `visibility` is that missing axis. It defaults to `private`, so a site arrives closed and is
 * opened deliberately.
 *
 * EVERY TENANT THAT EXISTS WHEN THIS RUNS IS SET TO `public`, explicitly. They are serving today and
 * they go on serving; an upgrade that silently took live sites dark would be the worst possible way
 * to ship a safety feature. The declared default applies to sites created after this point, which is
 * the only place the new rule belongs.
 */
export class TenantVisibilityMigration extends BaseMigration {
  readonly version = 39;
  readonly name = 'Sites are private until published';

  private static readonly TABLE = '_system_tenants';
  private static readonly logger = new Logger({ namespace: 'TenantVisibilityMigration' });

  async up(db: IDatabaseManager): Promise<void> {
    const { TABLE, logger } = TenantVisibilityMigration;

    // Whether the column is being introduced RIGHT NOW decides whether the backfill is safe. If it
    // already exists, every value in it was chosen — by the default or by an operator — and opening
    // those sites would override a decision somebody made. The migration runner records versions and
    // does not re-run, so this is a belt to that brace, not the only guard.
    const existed = await this.hasVisibilityColumn(db);

    await db.execute(sql.raw(
      `ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private'`,
    ));

    if (existed) {
      logger.info(`${TABLE}.visibility already existed; leaving every site's visibility as it is.`);
      return;
    }

    const result: any = await db.execute(sql.raw(`UPDATE ${TABLE} SET visibility = 'public'`));
    const opened = Number(result?.rowCount ?? result?.rows?.length ?? 0);

    logger.info(
      `${TABLE}.visibility added, default 'private'. ${opened} existing site(s) set to 'public': they were `
      + 'serving before this column existed and keep serving. New sites are private until published.',
    );
  }

  /** Whether the column is already there, asked before adding it. */
  private async hasVisibilityColumn(db: IDatabaseManager): Promise<boolean> {
    const result: any = await db.execute(sql.raw(
      `SELECT 1 AS present FROM information_schema.columns
        WHERE table_name = '${TenantVisibilityMigration.TABLE}' AND column_name = 'visibility'`,
    ));
    const rows: any[] = Array.isArray(result) ? result : (result?.rows ?? []);
    return rows.length > 0;
  }
}

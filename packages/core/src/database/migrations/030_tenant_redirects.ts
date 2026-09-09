import { BaseMigration, IDatabaseManager, sql, TenantRlsSql } from '@fromcode119/database';
import { ColumnGuard } from '@core/database/helpers/column-guard';
import { DialectHelper } from '@core/database/helpers/dialect';
import { Logger } from '@core/logging';

/**
 * Redirects belong to a SITE, not to the platform.
 *
 * `_system_redirects` (migration 019) predates tenancy and was never revisited, so every rule was global:
 * one site's URL migration rewrote every other site's URLs. Measured on a nine-tenant install before this
 * migration — a `/php -> /technologies/php` rule seeded for one site also fired on two others, sending
 * them to a page that does not exist there. A 301 into a 404 is worse than the 404 it replaced, because
 * it spends the redirect and delivers nothing.
 *
 * Two changes, and the second is as important as the first:
 *
 * 1. The table comes under row-level security like `_system_meta` (022), `_system_plugin_settings` (024)
 *    and the theme tables (025) already did. `TenantRlsSql` supplies the column, its default, the index,
 *    ENABLE + FORCE and the policy.
 *
 * 2. `from_path` STOPS BEING GLOBALLY UNIQUE and becomes unique PER SITE. Left alone, the original
 *    constraint would have made this worse rather than better: the first site to claim `/php` would own
 *    it platform-wide and every other site would be refused its own rule, with the failure surfacing as
 *    a duplicate-key error from a completely unrelated customer's data.
 *
 * Rows that predate this keep `tenant_id` NULL and are therefore invisible to every site — fail-closed,
 * and a signal that they need an owner rather than a silent leak. They are counted and reported, never
 * deleted or assigned to a guessed tenant.
 */
export class TenantRedirectsMigration extends BaseMigration {
  readonly version = 30;
  readonly name = 'Redirects are per site, not platform-wide';

  // The table name lives in `SystemRedirectService`; repeated here because a migration must not
  // import a service, and it is the same literal migration 019 created.
  private static readonly TABLE = '_system_redirects';
  private static readonly LEGACY_UNIQUE = '_system_redirects_from_path_key';
  private static readonly logger = new Logger({ namespace: 'TenantRedirectsMigration' });

  async up(db: IDatabaseManager): Promise<void> {
    await this.reportUnownedRules(db);

    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        for (const statement of TenantRlsSql.statementsFor(TenantRedirectsMigration.TABLE)) {
          await db.execute(sql.raw(statement));
        }
        // `scopeUniqueConstraintStatement` is the framework's own helper for exactly this: it drops the
        // single-column constraint and rebuilds it as `(from_path, tenant_id)` under the SAME name, in
        // one statement, so the table is never briefly without a uniqueness rule.
        if (await TenantRedirectsMigration.hasConstraint(db, TenantRedirectsMigration.LEGACY_UNIQUE)) {
          await db.execute(sql.raw(TenantRlsSql.scopeUniqueConstraintStatement(
            TenantRedirectsMigration.TABLE, TenantRedirectsMigration.LEGACY_UNIQUE, ['from_path'],
          )));
        }
      },
      sqlite: async () => {
        // No row-level security on SQLite; isolation there is file-per-tenant (see the S1 spec). The
        // column is still added so the two dialects hold the same shape and a row exported from one
        // can be imported into the other.
        await ColumnGuard.addIfMissing(db, TenantRedirectsMigration.TABLE, TenantRlsSql.COLUMN, 'TEXT');
      },
    });
  }

  /** Re-running must not fail on a constraint that scoping already replaced. */
  private static async hasConstraint(db: IDatabaseManager, constraint: string): Promise<boolean> {
    const rows = await db.execute(sql.raw(
      `SELECT 1 FROM pg_constraint WHERE conname = '${constraint}' `
      + `AND conrelid = '${TenantRedirectsMigration.TABLE}'::regclass`,
    )) as unknown as { length?: number } | { rows?: unknown[] };
    const list = (rows as { rows?: unknown[] })?.rows ?? (rows as unknown[]);
    return Array.isArray(list) ? list.length > 0 : Boolean(list);
  }

  /** Existing global rules become ownerless. Say so — silently hiding somebody's redirects is worse. */
  private async reportUnownedRules(db: IDatabaseManager): Promise<void> {
    try {
      const rows = await db.find(TenantRedirectsMigration.TABLE, { limit: 1000 }) as unknown[];
      if (!rows?.length) return;
      TenantRedirectsMigration.logger.warn(
        `${rows.length} redirect rule(s) predate tenancy and have no owning site, so they will be `
        + 'invisible to every site from now on. They are not deleted: assign each one a tenant_id, or '
        + 'recreate it from the site that needs it.',
      );
    } catch {
      // A table that does not exist yet is the greenfield case, and there is nothing to report.
    }
  }

  /**
   * The unique constraint stays `(from_path, tenant_id)` on the way down, deliberately.
   *
   * Restoring the single-column rule would require every site's rules to be globally unique again,
   * which is only true if no two sites ever claimed the same path. Where they did, Postgres would
   * refuse the constraint and the only way to force it through is to DELETE one site's redirects —
   * a migration must never do that. `removalStatementsFor` takes the policy off, which is what this
   * path exists for; the per-site uniqueness is harmless without it.
   */
  async down(db: IDatabaseManager): Promise<void> {
    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        for (const statement of TenantRlsSql.removalStatementsFor(
          TenantRedirectsMigration.TABLE, [`${TenantRedirectsMigration.TABLE}_tenant_isolation`],
        )) {
          await db.execute(sql.raw(statement));
        }
      },
      sqlite: async () => undefined,
    });
  }
}

import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';
import { DialectHelper } from '@core/database/helpers/dialect';
import { Logger } from '@core/logging';

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
export class TenantOwnedArtifactsMigration extends BaseMigration {
  readonly version = 45;
  readonly name = 'A theme or plugin can be owned by one site instead of by the platform';

  private static readonly COLUMN = 'owner_tenant_id';
  private static readonly TABLES = ['_system_themes', '_system_plugins'] as const;
  private static readonly logger = new Logger({ namespace: 'TenantOwnedArtifactsMigration' });

  async up(db: IDatabaseManager): Promise<void> {
    const { COLUMN, TABLES, logger } = TenantOwnedArtifactsMigration;

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
   * Whether the column is already there, asked before adding it.
   *
   * `information_schema` is PostgreSQL's and MySQL's; SQLite answers with `PRAGMA table_info` and
   * errors on the other form, which would take the whole boot down on that driver.
   */
  private async hasOwnerColumn(db: IDatabaseManager, table: string): Promise<boolean> {
    const { COLUMN } = TenantOwnedArtifactsMigration;
    let present = false;

    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        present = TenantOwnedArtifactsMigration.hasRow(await db.execute(sql.raw(
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
        present = TenantOwnedArtifactsMigration.hasRow(await db.execute(sql.raw(
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
}

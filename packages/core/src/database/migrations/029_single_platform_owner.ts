import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';
import { DialectHelper } from '@core/database/helpers/dialect';
import { Logger } from '@core/logging';

/**
 * Exactly one platform OWNER, enforced by the database.
 *
 * `users.is_platform_admin` already grants every tenant and gates plugin installation, but nothing ever
 * constrained how many accounts carried it, and nothing could move it — it changed only by direct SQL.
 * Ownership is now a single seat that transfers: the holder hands it to someone else and drops to a
 * plain admin. A partial unique index makes "at most one" structural, so a bug or a stray UPDATE cannot
 * produce two owners while every authorization check still reads the same column.
 *
 * The index is global rather than per-tenant on purpose: ownership is a platform fact, which is also why
 * `is_platform_admin` is excluded from tenant archive export/import and cannot arrive by importing a
 * tenant.
 *
 * Installs with several platform admins keep the LOWEST id — the oldest account, the likeliest original
 * owner — and the rest are demoted to whatever roles they already hold. Nothing is deleted, and the seat
 * can be handed back by transferring it. An install with NO platform admin is left alone: inventing an
 * owner would hand someone powers no operator granted.
 */
export class SinglePlatformOwnerMigration extends BaseMigration {
  readonly version = 29;
  readonly name = 'Exactly one platform owner, transferable';

  private static readonly INDEX = 'users_single_platform_owner';
  private static readonly logger = new Logger({ namespace: 'SinglePlatformOwnerMigration' });

  async up(db: IDatabaseManager): Promise<void> {
    await this.reportExtraOwners(db);

    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        await db.execute(sql`
          UPDATE "users" SET "is_platform_admin" = FALSE
           WHERE "is_platform_admin" = TRUE
             AND "id" <> (SELECT MIN("id") FROM "users" WHERE "is_platform_admin" = TRUE)
        `);
        await db.execute(sql`
          CREATE UNIQUE INDEX IF NOT EXISTS "users_single_platform_owner"
            ON "users" ("is_platform_admin") WHERE "is_platform_admin"
        `);
      },
      sqlite: async () => {
        await db.execute(sql`
          UPDATE "users" SET "is_platform_admin" = 0
           WHERE "is_platform_admin" = 1
             AND "id" <> (SELECT MIN("id") FROM "users" WHERE "is_platform_admin" = 1)
        `);
        await db.execute(sql`
          CREATE UNIQUE INDEX IF NOT EXISTS "users_single_platform_owner"
            ON "users" ("is_platform_admin") WHERE "is_platform_admin" = 1
        `);
      },
      mysql: async () => {
        // MySQL has no partial index, so the single-seat rule is upheld by PlatformOwnershipService
        // alone here. The demotion still runs, so the data matches the rule either way.
        await db.execute(sql`
          UPDATE "users" SET "is_platform_admin" = FALSE
           WHERE "is_platform_admin" = TRUE
             AND "id" <> (SELECT "id" FROM (SELECT MIN("id") AS "id" FROM "users" WHERE "is_platform_admin" = TRUE) AS "first")
        `);
      },
    });
  }

  /** Names the accounts about to lose the seat, so the change is never silent. */
  private async reportExtraOwners(db: IDatabaseManager): Promise<void> {
    const result: any = await db.execute(sql`
      SELECT "id", "email" FROM "users"
       WHERE "is_platform_admin" = TRUE
         AND "id" <> (SELECT MIN("id") FROM "users" WHERE "is_platform_admin" = TRUE)
    `).catch(() => null);

    for (const row of result?.rows ?? []) {
      SinglePlatformOwnerMigration.logger.warn(
        `Demoting extra platform admin ${row?.email ?? row?.id} — ownership is now a single seat. `
        + 'The account keeps its existing roles; the seat can be transferred back by the owner.',
      );
    }
  }

  async down(db: IDatabaseManager): Promise<void> {
    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        await db.execute(sql`DROP INDEX IF EXISTS "users_single_platform_owner"`);
      },
      sqlite: async () => {
        await db.execute(sql`DROP INDEX IF EXISTS "users_single_platform_owner"`);
      },
      mysql: async () => {
        // No index was created.
      },
    });
  }
}

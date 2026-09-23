import { ColumnGuard } from '@core/database/helpers/column-guard';
import { DialectHelper } from '@core/database/helpers/dialect';
import { Logger } from '@core/logging';
import { BaseMigration, IDatabaseManager, TenantColumn, sql } from '@fromcode119/database';

/**
 * The platform becomes multi-site.
 *
 * Tenants and the hosts that route to them; who belongs to which site; per-site settings, media,
 * plugin enablement and theme activation; the identity each isolated plugin runs as; site kinds; shares
 * that can point at any record; exactly one transferable platform owner; and URL redirects, owned by
 * the framework and scoped per site. Tenant data gets `tenant_id` and a FORCEd row-level-security
 * policy through `tenantIsolation.isolateTable`, which is why these steps are kept as steps rather
 * than folded into their tables' CREATE statements.
 *
 * Versions 19–30 consolidated. A database that ran them has all twelve recorded and runs nothing
 * here; a fresh install runs the steps below in their original order.
 */
export class MultiSitePlatformMigration extends BaseMigration {
  readonly version = 19;
  readonly name = 'Multi-site platform: tenants, memberships and per-site scope';

  async up(db: IDatabaseManager): Promise<void> {
    await this.v019SystemRedirects(db);
    await this.v020SystemTenants(db);
    await this.v021TenantMemberships(db);
    await this.v022SettingsAndMediaScope(db);
    await this.v023SettingsIdentity(db);
    await this.v024TenantPlugins(db);
    await this.v025TenantThemes(db);
    await this.v026IsolationIdentities(db);
    await this.v027TenantKinds(db);
    await this.v028RecordShares(db);
    await this.v029SinglePlatformOwner(db);
    await this.v030TenantRedirects(db);
  }

  private async createTable(db: IDatabaseManager): Promise<void> {
    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS "_system_redirects" (
            "id" SERIAL PRIMARY KEY,
            "from_path" TEXT NOT NULL UNIQUE,
            "to_path" TEXT NOT NULL,
            "type" TEXT NOT NULL DEFAULT '301',
            "enabled" INTEGER NOT NULL DEFAULT 1,
            "hit_count" INTEGER NOT NULL DEFAULT 0,
            "notes" TEXT DEFAULT '',
            "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        await db.execute(sql`
          CREATE INDEX IF NOT EXISTS "idx_system_redirects_lookup"
            ON "_system_redirects" ("from_path", "enabled")
        `);
      },
      mysql: async () => {
        await db.execute(sql.raw(`
          CREATE TABLE IF NOT EXISTS _system_redirects (
            id INT AUTO_INCREMENT PRIMARY KEY,
            -- 512, not 768. These tables are utf8mb4, so an index counts 4 bytes per character:
            -- 768 is exactly InnoDB's 3072-byte ceiling for the UNIQUE alone, and the composite
            -- index below adds enabled on top, which puts it over. The table could never be
            -- created on MySQL. 512*4 = 2048 leaves room for both.
            from_path VARCHAR(512) NOT NULL UNIQUE,
            to_path TEXT NOT NULL,
            type VARCHAR(8) NOT NULL DEFAULT '301',
            enabled INT NOT NULL DEFAULT 1,
            hit_count INT NOT NULL DEFAULT 0,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_system_redirects_lookup (from_path, enabled)
          )
        `));
      },
      sqlite: async () => {
        await db.execute(sql.raw(`
          CREATE TABLE IF NOT EXISTS "_system_redirects" (
            "id" INTEGER PRIMARY KEY AUTOINCREMENT,
            "from_path" TEXT NOT NULL UNIQUE,
            "to_path" TEXT NOT NULL,
            "type" TEXT NOT NULL DEFAULT '301',
            "enabled" INTEGER NOT NULL DEFAULT 1,
            "hit_count" INTEGER NOT NULL DEFAULT 0,
            "notes" TEXT DEFAULT '',
            "created_at" TEXT DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `));
        await db.execute(sql.raw(`
          CREATE INDEX IF NOT EXISTS "idx_system_redirects_lookup"
            ON "_system_redirects" ("from_path", "enabled")
        `));
      },
    });
  }

  /** The tenant's record of a person — where the real PII lives, unlike the thin `users` row. */
  private static readonly PEOPLE_TABLES = [
    'people', 'people_addresses', 'person_relationships', 'person_catalogs',
  ];


  private static async createMembershipTable(
    db: IDatabaseManager,
    types: { id: string; key: string; json: string; jsonDefault: string; timestamp: string },
  ): Promise<void> {
    const rolesDefault = types.jsonDefault ? ` NOT NULL DEFAULT ${types.jsonDefault}` : '';
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "_system_tenant_memberships" (
        "id" ${types.id},
        "user_id" ${types.key} NOT NULL,
        "tenant_id" ${types.key} NOT NULL,
        "roles" ${types.json}${rolesDefault},
        "state" ${types.key} NOT NULL DEFAULT 'active',
        "created_at" ${types.timestamp} DEFAULT CURRENT_TIMESTAMP,
        "updated_at" ${types.timestamp} DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "_system_tenant_memberships_unique" UNIQUE ("user_id", "tenant_id")
      )
    `));

    await db.execute(sql.raw(
      'CREATE INDEX IF NOT EXISTS "_system_tenant_memberships_tenant_idx" '
      + 'ON "_system_tenant_memberships" ("tenant_id")',
    ));
  }


  /**
   * A platform admin is not a member of any tenant — the role sits on the account itself. It is what
   * makes provisioning and customer support possible, and it is the highest-value credential in the
   * system, so it defaults to FALSE and is granted deliberately.
   */
  private static async addPlatformAdminFlag(db: IDatabaseManager): Promise<void> {
    // Called from BOTH dialect branches, so it cannot use either dialect's exclusive syntax.
    await ColumnGuard.addIfMissing(db, 'users', 'is_platform_admin', 'BOOLEAN NOT NULL DEFAULT FALSE');
  }


  /**
   * Which tenant a session belongs to.
   *
   * Sessions record this but are NOT row-level-security scoped, and that is deliberate rather than an
   * omission: validating a session is what TELLS us the tenant, so a policy here would be circular —
   * reading the session would require the tenant only the session can supply. The binding that
   * matters is the signed tenant claim in the token (`AuthManager.verifyToken`), which cannot be
   * forged, plus a membership re-check on every request. Session LISTING in the admin filters by this
   * column in the query layer.
   *
   * Called from ALL THREE dialect branches — `ColumnGuard` asks each driver in its own words, because
   * SQLite has no `ADD COLUMN IF NOT EXISTS`. It lived only in the PostgreSQL branch until a SQLite
   * install was actually attempted, and the column is not optional: the runtime writes it on every
   * session insert regardless of driver.
   *
   * `keyType` is `TEXT` on Postgres/SQLite and `VARCHAR(191)` on MySQL — the CREATE INDEX below is
   * exactly the case the class docblock's "key" rule covers, so MySQL cannot take the TEXT spelling.
   */
  private static async addSessionTenantColumn(db: IDatabaseManager, keyType: string): Promise<void> {
    // Existing sessions are deleted: they carry no tenant claim, so they would be refused on the
    // next request anyway. Introducing tenancy logs everyone out, deliberately.
    await db.execute(sql.raw('DELETE FROM "_system_sessions"'));
    await ColumnGuard.addIfMissing(db, '_system_sessions', 'tenant_id', keyType);
    await db.execute(sql.raw(
      'CREATE INDEX IF NOT EXISTS "_system_sessions_tenant_idx" ON "_system_sessions" ("tenant_id")',
    ));
  }



  /**
   * Deployment truths a tenant cannot own. Everything else is per-tenant, because site name,
   * locale, timezone and email config are what make two sites different sites.
   */
  private static readonly PLATFORM_KEYS = [
    'marketplace_url', 'admin_url', 'frontend_url', 'site_url',
    'maintenance_mode', 'setup_completed',
  ];


  /**
   * `tenant_id IS NULL` means PLATFORM-LEVEL. This is the one place on the platform where a NULL
   * carries meaning rather than being an accident, so the schema says so and the admin surfaces it.
   */
  private static async scopeSettings(db: IDatabaseManager): Promise<void> {
    await db.execute(sql.raw('ALTER TABLE "_system_meta" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT'));
    await db.execute(sql.raw(
      'CREATE INDEX IF NOT EXISTS "_system_meta_tenant_idx" ON "_system_meta" ("tenant_id")',
    ));

    // Existing rows predate tenancy and are deployment-wide truths, so they become platform-level
    // rather than being assigned to an arbitrary tenant. Anything a tenant should own is set again
    // per tenant from its own admin.
    const keys = MultiSitePlatformMigration.PLATFORM_KEYS.map((key) => `'${key}'`).join(', ');
    await db.execute(sql.raw(
      `UPDATE "_system_meta" SET "tenant_id" = NULL WHERE "key" IN (${keys})`,
    ));

    await db.execute(sql.raw('ALTER TABLE "_system_meta" ENABLE ROW LEVEL SECURITY'));
    await db.execute(sql.raw('ALTER TABLE "_system_meta" FORCE ROW LEVEL SECURITY'));
    await db.execute(sql.raw('DROP POLICY IF EXISTS "_system_meta_tenant_isolation" ON "_system_meta"'));
    // WITH CHECK is wider than "own tenant" by exactly one case: a PLATFORM row, and only while the
    // connection has been marked as acting for a platform admin.
    //
    // Without that case a platform-level setting would be writable by nobody at all — not even the
    // schema owner — because `tenant_id IS NULL` can never equal the current tenant. The marker is a
    // separate GUC the framework sets only after verifying the account, so "may write platform
    // settings" is an explicit, inspectable state on the connection rather than an implicit
    // consequence of which role happens to be connected.
    await db.execute(sql.raw(`
      CREATE POLICY "_system_meta_tenant_isolation" ON "_system_meta"
        USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '') OR "tenant_id" IS NULL)
        WITH CHECK (
          "tenant_id" = nullif(current_setting('app.tenant_id', true), '')
          OR ("tenant_id" IS NULL AND current_setting('app.platform_admin', true) = 'on')
        )
    `));
  }


  /**
   * `shared` defaults to FALSE — sharing is always a deliberate act. `WITH CHECK` keeps every write
   * to the owning tenant, which is what makes a shared asset READ-ONLY to everyone else: a borrower
   * can display it and cannot change or delete another customer's file.
   */
  private static async scopeMedia(db: IDatabaseManager): Promise<void> {
    // The full sequence lives here, not in the generic sweep: media is excluded from that path
    // precisely so this policy is not overwritten on the next boot.
    await db.execute(sql.raw(
      'ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT '
      + "DEFAULT nullif(current_setting('app.tenant_id', true), '')",
    ));
    await db.execute(sql.raw('CREATE INDEX IF NOT EXISTS "media_tenant_id_idx" ON "media" ("tenant_id")'));
    await db.execute(sql.raw(
      'ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "shared" BOOLEAN NOT NULL DEFAULT FALSE',
    ));
    await db.execute(sql.raw('ALTER TABLE "media" ENABLE ROW LEVEL SECURITY'));
    await db.execute(sql.raw('ALTER TABLE "media" FORCE ROW LEVEL SECURITY'));

    // FOUR policies, one per command, because WITH CHECK does not govern DELETE.
    //
    // A single `USING (own OR shared) WITH CHECK (own)` policy looks right and is not: WITH CHECK
    // constrains INSERT and UPDATE only, so DELETE falls back to USING — and a borrower could delete
    // another tenant's shared asset out from under them. Sharing must widen READS and nothing else.
    const own = `"tenant_id" = nullif(current_setting('app.tenant_id', true), '')`;

    for (const name of ['media_tenant_isolation', 'media_tenant_select', 'media_tenant_insert',
                        'media_tenant_update', 'media_tenant_delete']) {
      await db.execute(sql.raw(`DROP POLICY IF EXISTS "${name}" ON "media"`));
    }

    await db.execute(sql.raw(
      `CREATE POLICY "media_tenant_select" ON "media" FOR SELECT USING (${own} OR "shared" IS TRUE)`,
    ));
    await db.execute(sql.raw(
      `CREATE POLICY "media_tenant_insert" ON "media" FOR INSERT WITH CHECK (${own})`,
    ));
    await db.execute(sql.raw(
      `CREATE POLICY "media_tenant_update" ON "media" FOR UPDATE USING (${own}) WITH CHECK (${own})`,
    ));
    await db.execute(sql.raw(
      `CREATE POLICY "media_tenant_delete" ON "media" FOR DELETE USING (${own})`,
    ));
  }

  /**
   * Deployment truths a tenant cannot own — the ONLY keys a tenant may read from the platform row.
   *
   * Deliberately the same list as migration 022, and deliberately in the policy rather than in
   * application code: which settings cross the tenant boundary is a security boundary, so it is
   * enforced by the database and changing it takes a migration.
   */
  private static readonly PLATFORM_KEYS_V23 = [
    'marketplace_url', 'admin_url', 'frontend_url', 'site_url',
    'maintenance_mode', 'setup_completed',
    'ssr_generation_cap',
    'plugin_isolation_default', 'plugin_isolation_memory_mb', 'plugin_isolation_timeout_ms',
    'ssr_render_memory_mb', 'ssr_render_timeout_ms',
  ];


  /**
   * `NULLS NOT DISTINCT` is what makes this work: without it Postgres treats every NULL as unique,
   * so the platform row would stop being unique per key and duplicates could accumulate silently.
   * It needs Postgres 15+, which this deployment is.
   */
  private static async widenPrimaryKey(db: IDatabaseManager): Promise<void> {
    await db.execute(sql.raw('ALTER TABLE "_system_meta" DROP CONSTRAINT IF EXISTS "_system_meta_pkey"'));
    await db.execute(sql.raw(
      'ALTER TABLE "_system_meta" ADD CONSTRAINT "_system_meta_pkey" '
      + 'UNIQUE NULLS NOT DISTINCT ("key", "tenant_id")',
    ));
  }


  /**
   * Every existing tenant inherits the configuration that was in force, so nothing changes for
   * anyone on the day this runs.
   *
   * The platform rows are NOT deleted. On a single-tenant deployment there are no tenants to copy
   * to, and deleting would erase every setting on the platform; they also stay as the value a tenant
   * created later starts from, which is a reader, not dead weight.
   */
  private static async giveEachTenantItsOwnRows(db: IDatabaseManager): Promise<void> {
    const keys = MultiSitePlatformMigration.PLATFORM_KEYS_V23.map((key) => `'${key}'`).join(', ');

    // FORCE ROW LEVEL SECURITY applies to the table OWNER too — that is the whole reason it exists
    // (without it the owner reads every tenant's rows while everything looks healthy). But it also
    // means this migration, running as the owner with no tenant bound, cannot write the per-tenant
    // rows it exists to write: `WITH CHECK` rejects every one of them with
    // `new row violates row-level security policy`. Lifting FORCE for the copy and restoring it
    // immediately afterwards is the narrow, explicit way through; the alternative — a policy loose
    // enough for the migration to slip past — would be loose for every request as well.
    await db.execute(sql.raw('ALTER TABLE "_system_meta" NO FORCE ROW LEVEL SECURITY'));
    await db.execute(sql.raw(`
      INSERT INTO "_system_meta" ("key", "value", "description", "group", "tenant_id")
      SELECT m."key", m."value", m."description", m."group", t."id"
      FROM "_system_meta" m
      CROSS JOIN "_system_tenants" t
      WHERE m."tenant_id" IS NULL AND m."key" NOT IN (${keys})
      ON CONFLICT DO NOTHING
    `));
    await db.execute(sql.raw('ALTER TABLE "_system_meta" FORCE ROW LEVEL SECURITY'));
  }


  /**
   * A tenant sees the platform row ONLY for the deployment truths above. Every other key resolves to
   * exactly one visible row — its own — so there is no precedence question left to get wrong.
   *
   * THE SECOND BRANCH IS NOT OPTIONAL. When no tenant is bound to the connection there is no
   * single-tenant deployment to speak of — there is just a deployment, and ALL of its settings are
   * the platform rows. Narrowing unconditionally would have hidden 54 of the 60 rows from every
   * installation that has no tenants, which is every existing installation. That is precisely the
   * failure T0 §8.1 already had to correct once: a tenancy rule written as if tenants always exist.
   *
   * WITH CHECK is unchanged from 022: a tenant writes its own rows, and a platform row is writable
   * only while the connection carries the verified platform-admin marker.
   */
  private static async narrowPlatformReads(db: IDatabaseManager): Promise<void> {
    const keys = MultiSitePlatformMigration.PLATFORM_KEYS_V23.map((key) => `'${key}'`).join(', ');
    const current = `nullif(current_setting('app.tenant_id', true), '')`;
    const own = `"tenant_id" = ${current}`;

    // Re-asserted rather than assumed: 022 set them, but this migration lifted FORCE for the copy
    // above and a table left un-FORCEd would let the owner connection read every tenant.
    await db.execute(sql.raw('ALTER TABLE "_system_meta" ENABLE ROW LEVEL SECURITY'));
    await db.execute(sql.raw('ALTER TABLE "_system_meta" FORCE ROW LEVEL SECURITY'));
    await db.execute(sql.raw('DROP POLICY IF EXISTS "_system_meta_tenant_isolation" ON "_system_meta"'));
    await db.execute(sql.raw(`
      CREATE POLICY "_system_meta_tenant_isolation" ON "_system_meta"
        USING (
          ${own}
          OR ("tenant_id" IS NULL AND (${current} IS NULL OR "key" IN (${keys})))
        )
        WITH CHECK (
          ${own}
          OR ("tenant_id" IS NULL AND current_setting('app.platform_admin', true) = 'on')
        )
    `));
  }

  /**
   * Two tenants running the same plugin configure it independently — without this, "per-tenant
   * plugins" would still share one configuration.
   *
   * The primary key has to be widened FIRST, and that is not a detail. `_system_plugin_settings` is
   * keyed on `plugin_slug` alone, so the second tenant to save settings for a plugin would get
   * `duplicate key value violates unique constraint` — the identical defect this migration's
   * predecessor (023) had to fix in `_system_meta`, where it made per-tenant settings impossible
   * while every isolation test still passed.
   */
  private static async scopePluginSettings(db: IDatabaseManager): Promise<void> {
    await db.execute(sql.raw(
      'ALTER TABLE "_system_plugin_settings" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT '
      + "DEFAULT nullif(current_setting('app.tenant_id', true), '')",
    ));
    await db.execute(sql.raw(
      'CREATE INDEX IF NOT EXISTS "_system_plugin_settings_tenant_idx" '
      + 'ON "_system_plugin_settings" ("tenant_id")',
    ));

    // NULLS NOT DISTINCT keeps the pre-tenancy row unique per plugin; without it Postgres treats
    // every NULL as distinct and duplicates would accumulate unseen.
    await db.execute(sql.raw(
      'ALTER TABLE "_system_plugin_settings" DROP CONSTRAINT IF EXISTS "_system_plugin_settings_pkey"',
    ));
    await db.execute(sql.raw(
      'ALTER TABLE "_system_plugin_settings" ADD CONSTRAINT "_system_plugin_settings_pkey" '
      + 'UNIQUE NULLS NOT DISTINCT ("plugin_slug", "tenant_id")',
    ));

    // Every existing tenant inherits the configuration in force today, so enabling per-tenant plugin
    // settings changes nobody's behaviour on the day it runs.
    await db.execute(sql.raw(`
      INSERT INTO "_system_plugin_settings" ("plugin_slug", "settings", "tenant_id")
      SELECT s."plugin_slug", s."settings", t."id"
      FROM "_system_plugin_settings" s
      CROSS JOIN "_system_tenants" t
      WHERE s."tenant_id" IS NULL
      ON CONFLICT DO NOTHING
    `));

    await db.execute(sql.raw('ALTER TABLE "_system_plugin_settings" ENABLE ROW LEVEL SECURITY'));
    await db.execute(sql.raw('ALTER TABLE "_system_plugin_settings" FORCE ROW LEVEL SECURITY'));
    await db.execute(sql.raw(
      'DROP POLICY IF EXISTS "_system_plugin_settings_tenant_isolation" ON "_system_plugin_settings"',
    ));

    // The second branch of USING is what keeps a deployment with NO tenants working: nothing binds a
    // tenant there, so without it every plugin would read back an empty configuration and silently
    // fall to its schema defaults. Unlike `_system_meta` there is no list of shared keys — a plugin's
    // configuration is never platform-level once tenants exist.
    const current = `nullif(current_setting('app.tenant_id', true), '')`;
    await db.execute(sql.raw(`
      CREATE POLICY "_system_plugin_settings_tenant_isolation" ON "_system_plugin_settings"
        USING ("tenant_id" = ${current} OR ("tenant_id" IS NULL AND ${current} IS NULL))
        WITH CHECK (
          "tenant_id" = ${current}
          OR ("tenant_id" IS NULL AND current_setting('app.platform_admin', true) = 'on')
        )
    `));
  }


  private static async createTableV24(db: IDatabaseManager, timestamp: string, key: string = 'TEXT'): Promise<void> {
    // No foreign keys: `_system_plugins` rows come and go with installation, and a tenant row can be
    // removed by T4. A dangling enablement row is harmless (the plugin is not loadable, so the
    // platform axis refuses it anyway), whereas an FK would make uninstalling a plugin fail while
    // any tenant still has a row for it — turning a routine operator action into a puzzle.
    //
    // `key` is `TEXT` on Postgres/SQLite and `VARCHAR(191)` on MySQL: `tenant_id`/`plugin_slug` are
    // the composite primary key and `state` carries a DEFAULT, and MySQL accepts neither on a TEXT
    // column.
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "_system_tenant_plugins" (
        "tenant_id" ${key} NOT NULL,
        "plugin_slug" ${key} NOT NULL,
        "state" ${key} NOT NULL DEFAULT 'active',
        "enabled_at" ${timestamp},
        "updated_at" ${timestamp} DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "_system_tenant_plugins_pk" PRIMARY KEY ("tenant_id", "plugin_slug")
      )
    `));

    await db.execute(sql.raw(
      'CREATE INDEX IF NOT EXISTS "_system_tenant_plugins_tenant_idx" '
      + 'ON "_system_tenant_plugins" ("tenant_id")',
    ));
  }


  /**
   * Every plugin that is active today is enabled for every tenant that exists today.
   *
   * This is the whole difference between a migration and an outage. Without it, the moment the new
   * per-tenant gate goes live, no tenant has a row for anything and every plugin turns off at once
   * for every customer — while the admin still reports them all "active" on the platform axis.
   */
  /**
   * `ON CONFLICT DO NOTHING` is the Postgres spelling, and SQLite accepts it unchanged (its upsert
   * syntax is Postgres-compatible on this exact clause). MySQL has neither — it needs `INSERT IGNORE`
   * instead, which is why this takes `insertKeyword` rather than being one shared statement.
   */
  private static async backfillFromActivePlugins(db: IDatabaseManager, insertKeyword = 'INSERT'): Promise<void> {
    await db.execute(sql.raw(`
      ${insertKeyword} INTO "_system_tenant_plugins" ("tenant_id", "plugin_slug", "state", "enabled_at")
      SELECT t."id", p."slug", 'active', CURRENT_TIMESTAMP
      FROM "_system_tenants" t
      CROSS JOIN "_system_plugins" p
      WHERE p."state" = 'active'
      ${insertKeyword === 'INSERT' ? 'ON CONFLICT DO NOTHING' : ''}
    `));
  }

  private static async createTableV25(
    db: IDatabaseManager, timestamp: string, json: string, key: string = 'TEXT',
  ): Promise<void> {
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "_system_tenant_themes" (
        "tenant_id" ${key} NOT NULL,
        "theme_slug" ${key} NOT NULL,
        "state" ${key} NOT NULL DEFAULT 'inactive',
        "config" ${json},
        "updated_at" ${timestamp} DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "_system_tenant_themes_pk" PRIMARY KEY ("tenant_id", "theme_slug")
      )
    `));
    await db.execute(sql.raw(
      'CREATE INDEX IF NOT EXISTS "_system_tenant_themes_tenant_idx" ON "_system_tenant_themes" ("tenant_id")',
    ));
  }


  /**
   * Every existing tenant gets the process-wide active theme — and its variable overrides — as its own
   * active row, so on the day this runs no storefront changes. A deployment with no tenants copies
   * nothing and keeps the single `activeTheme` it has today; a deployment with no active theme copies
   * nothing either, and that is the truth rather than an invented default.
   */
  private static async backfillFromActiveTheme(db: IDatabaseManager, insertKeyword = 'INSERT'): Promise<void> {
    await db.execute(sql.raw(`
      ${insertKeyword} INTO "_system_tenant_themes" ("tenant_id", "theme_slug", "state", "config")
      SELECT t."id", p."slug", 'active', p."config"
      FROM "_system_tenants" t
      CROSS JOIN "_system_themes" p
      WHERE p."state" = 'active'
      ${insertKeyword === 'INSERT' ? 'ON CONFLICT DO NOTHING' : ''}
    `));
  }

  private static readonly INDEX = 'users_single_platform_owner';

  private static readonly logger = new Logger({ namespace: 'SinglePlatformOwnerMigration' });


  /** Names the accounts about to lose the seat, so the change is never silent. */
  private async reportExtraOwners(db: IDatabaseManager): Promise<void> {
    const result: any = await db.execute(sql`
      SELECT "id", "email" FROM "users"
       WHERE "is_platform_admin" = TRUE
         AND "id" <> (SELECT MIN("id") FROM "users" WHERE "is_platform_admin" = TRUE)
    `).catch(() => null);

    for (const row of result?.rows ?? []) {
      MultiSitePlatformMigration.logger.warn(
        `Demoting extra platform admin ${row?.email ?? row?.id} — ownership is now a single seat. `
        + 'The account keeps its existing roles; the seat can be transferred back by the owner.',
      );
    }
  }


  // The table name lives in `SystemRedirectService`; repeated here because a migration must not
  // import a service, and it is the same literal migration 019 created.
  private static readonly TABLE = '_system_redirects';

  private static readonly LEGACY_UNIQUE = '_system_redirects_from_path_key';

  private static readonly loggerV30 = new Logger({ namespace: 'TenantRedirectsMigration' });


  /** Re-running must not fail on a constraint that scoping already replaced. */
  private static async hasConstraint(db: IDatabaseManager, constraint: string): Promise<boolean> {
    const rows = await db.execute(sql.raw(
      `SELECT 1 FROM pg_constraint WHERE conname = '${constraint}' `
      + `AND conrelid = '${MultiSitePlatformMigration.TABLE}'::regclass`,
    )) as unknown as { length?: number } | { rows?: unknown[] };
    const list = (rows as { rows?: unknown[] })?.rows ?? (rows as unknown[]);
    return Array.isArray(list) ? list.length > 0 : Boolean(list);
  }


  /** Existing global rules become ownerless. Say so — silently hiding somebody's redirects is worse. */
  private async reportUnownedRules(db: IDatabaseManager): Promise<void> {
    try {
      const rows = await db.find(MultiSitePlatformMigration.TABLE, { limit: 1000 }) as unknown[];
      if (!rows?.length) return;
      MultiSitePlatformMigration.loggerV30.warn(
        `${rows.length} redirect rule(s) predate tenancy and have no owning site, so they will be `
        + 'invisible to every site from now on. They are not deleted: assign each one a tenant_id, or '
        + 'recreate it from the site that needs it.',
      );
    } catch {
      // A table that does not exist yet is the greenfield case, and there is nothing to report.
    }
  }


  /**
   * URL redirect rules — ONE framework-owned store. Before this, the identical capability lived in two
   * plugins, each with its own table, schema, admin surface and resolver, first-match-wins by plugin
   * boot order. Redirects are routing, and routing is framework
   * territory (permalinks, resolution, the redirect registry all live here) — so the rules do too, and a
   * bare install with no plugin at all still supports them.
   *
   * `from_path` is unique — one rule per retired path. `type` is '301' (permanent → 308 at the routing
   * layer) or '302' (temporary → 307). Hit counting is maintained by the framework's own resolver.
   *
   * It used to also copy the rows out of those two plugins' tables. Every deployment ran that once, and
   * both plugins have since stopped creating their tables, so on any install today there is nothing to
   * copy — and the step could only do its job by naming the plugins, which the framework never does.
   */
  private async v019SystemRedirects(db: IDatabaseManager): Promise<void> {
    await this.createTable(db);
  }


  /**
   * `_system_tenants` — the tenant registry and host routing table.
   *
   * This is the table that RESOLVES tenancy, and therefore the one table that is never itself
   * tenant-scoped and carries no row-level-security policy: it must be readable before a tenant is
   * known. Everything else that holds tenant data gets `tenant_id` + a FORCEd RLS policy.
   *
   * `primary_host` is UNIQUE so two tenants cannot claim the same host. Host ambiguity is then a
   * data error caught at write time, never a routing guess at request time — serving one customer's
   * site on another's domain is exactly the failure this layer exists to prevent.
   */
  private async v020SystemTenants(db: IDatabaseManager): Promise<void> {
    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS "_system_tenants" (
            "id" TEXT PRIMARY KEY,
            "slug" TEXT NOT NULL UNIQUE,
            "primary_host" TEXT NOT NULL UNIQUE,
            "host_aliases" JSONB NOT NULL DEFAULT '[]'::jsonb,
            "state" TEXT NOT NULL DEFAULT 'active',
            "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        await db.execute(sql`
          CREATE INDEX IF NOT EXISTS "_system_tenants_state_idx" ON "_system_tenants" ("state")
        `);
      },
      sqlite: async () => {
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS "_system_tenants" (
            "id" TEXT PRIMARY KEY,
            "slug" TEXT NOT NULL UNIQUE,
            "primary_host" TEXT NOT NULL UNIQUE,
            "host_aliases" TEXT NOT NULL DEFAULT '[]',
            "state" TEXT NOT NULL DEFAULT 'active',
            "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
            "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        await db.execute(sql`
          CREATE INDEX IF NOT EXISTS "_system_tenants_state_idx" ON "_system_tenants" ("state")
        `);
      },
      mysql: async () => {
        // "id", "slug" and "primary_host" are each a key (PK or UNIQUE) so none can be TEXT; "state"
        // is indexed below so it needs the same width. `host_aliases` drops the JSON default — MySQL
        // rejects a literal default on a JSON column — the framework writes '[]' on every insert.
        await db.execute(sql.raw(`
          CREATE TABLE IF NOT EXISTS "_system_tenants" (
            "id" VARCHAR(191) PRIMARY KEY,
            "slug" VARCHAR(191) NOT NULL UNIQUE,
            "primary_host" VARCHAR(191) NOT NULL UNIQUE,
            "host_aliases" JSON NOT NULL,
            "state" VARCHAR(191) NOT NULL DEFAULT 'active',
            "created_at" TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX "_system_tenants_state_idx" ("state")
          )
        `));
      },
    });
  }

  /**
   * Per-tenant identity: memberships, the `users` isolation policy, and tenant-scoped sessions.
   *
   * `users` stays a single GLOBAL table and is deliberately NOT tenant-scoped. It is the identity
   * service — email, credential, roles — and an account spans tenants by design, so login must be
   * able to find it before any tenant is known. Putting a policy on it would mean an untenanted login
   * lookup returned zero rows and nobody could ever sign in.
   *
   * The substantive personal data is not in `users`; it is in `people` and its siblings (names, email,
   * phone, addresses, relationships). Those ARE brought under the ordinary tenant policy here, which
   * closes a real hole: until now one tenant's contacts were readable by another.
   */
  private async v021TenantMemberships(db: IDatabaseManager): Promise<void> {
    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        await MultiSitePlatformMigration.createMembershipTable(
          db, { id: 'SERIAL PRIMARY KEY', key: 'TEXT', json: 'JSONB', jsonDefault: "'[]'::jsonb", timestamp: 'TIMESTAMP' },
        );
        await MultiSitePlatformMigration.addPlatformAdminFlag(db);

        // Memberships are NOT tenant-scoped, and that is the same rule as `users`: anything needed
        // to RESOLVE tenancy cannot itself be tenant-scoped, or the lookup is circular. This table
        // answers "which tenants may this account enter" — a question asked at login, before any
        // tenant is known. A policy here would return zero rows and nobody could ever sign in.
        //
        // Membership is authorization, not tenant content. Who belongs to which tenant is filtered
        // in the query layer for admin listings; the row itself carries no customer data.
        // Sessions record which tenant they belong to, but are NOT row-level-security scoped, and
        // that is deliberate rather than an omission.
        //
        // Validating a session is what TELLS us the tenant — so a policy here would be circular:
        // reading the session would require the tenant that only the session can supply. The binding
        // that matters is the signed tenant claim in the token itself (AuthManager.verifyToken),
        // which cannot be forged, plus a membership re-check on every request. Session LISTING in
        // the admin filters by this column in the query layer.
        //
        await MultiSitePlatformMigration.addSessionTenantColumn(db, 'TEXT');

        // A tenant's people are its own. These tables hold the real PII — until now they were
        // unscoped, so one tenant's contacts were readable by every other tenant.
        for (const table of MultiSitePlatformMigration.PEOPLE_TABLES) {
          await db.tenantIsolation.isolateTable(table);
        }
      },
      sqlite: async () => {
        await MultiSitePlatformMigration.createMembershipTable(
          db, { id: 'INTEGER PRIMARY KEY AUTOINCREMENT', key: 'TEXT', json: 'TEXT', jsonDefault: "'[]'", timestamp: 'DATETIME' },
        );
        await MultiSitePlatformMigration.addPlatformAdminFlag(db);
        // The session column is NOT optional here, and leaving it out is what made SQLite unusable:
        // every session insert writes `tenant_id` whatever the driver, so without it nobody could
        // log in — the first-run wizard failed on "table _system_sessions has no column named
        // tenant_id" AFTER creating the administrator account.
        await MultiSitePlatformMigration.addSessionTenantColumn(db, 'TEXT');
        // No row-level security on SQLite, and nothing replaces it — the file-per-tenant silo (S1,
        // 2026-09-04) was designed and NOT adopted; see its spec. Single-site only here.
      },
      mysql: async () => {
        // "user_id"/"tenant_id" carry the UNIQUE below (and "tenant_id" the index after it), so
        // neither can be TEXT here — same rule as everywhere else in this file's MySQL branch.
        // `roles` drops the JSON default MySQL refuses; the runtime writes '[]' on every insert.
        await MultiSitePlatformMigration.createMembershipTable(
          db, { id: 'INT AUTO_INCREMENT PRIMARY KEY', key: 'VARCHAR(191)', json: 'JSON', jsonDefault: '', timestamp: 'TIMESTAMP NULL' },
        );
        await MultiSitePlatformMigration.addPlatformAdminFlag(db);
        await MultiSitePlatformMigration.addSessionTenantColumn(db, 'VARCHAR(191)');
        // No row-level security on MySQL, and nothing replaces it — `TenantMode` refuses to boot a
        // second tenant on this driver, so a deployment here is single-site only.
      },
    });
  }


  /**
   * Per-tenant settings, and media that can be deliberately shared.
   *
   * Two policies here are intentionally ASYMMETRIC — the `USING` clause is wider than the
   * `WITH CHECK`. That asymmetry is the whole safety mechanism:
   *
   *   settings — a tenant may READ a platform-level setting, and may never write one.
   *   media    — a tenant may READ a shared asset, and may never modify one it does not own.
   *
   * Without it, "shared" would mean "writable by everyone", which is a leak wearing a feature's
   * clothes.
   */
  private async v022SettingsAndMediaScope(db: IDatabaseManager): Promise<void> {
    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        await MultiSitePlatformMigration.scopeSettings(db);
        await MultiSitePlatformMigration.scopeMedia(db);
      },
      sqlite: async () => {
        await ColumnGuard.addIfMissing(db, '_system_meta', 'tenant_id', 'TEXT');
        await ColumnGuard.addIfMissing(db, 'media', 'shared', 'BOOLEAN NOT NULL DEFAULT FALSE');
        // No row-level security on SQLite, and NOTHING replaces it: this driver has no tenant
        // isolation at all. A file-per-tenant silo was designed (S1, 2026-09-04) and never adopted,
        // so do not read this branch as isolating anything — `TenantMode` refusing to boot a
        // multi-tenant deployment here is the real guard.
      },
      mysql: async () => {
        await ColumnGuard.addIfMissing(db, '_system_meta', 'tenant_id', 'TEXT');
        await ColumnGuard.addIfMissing(db, 'media', 'shared', 'BOOLEAN NOT NULL DEFAULT FALSE');
        // No row-level security on MySQL, and NOTHING replaces it — same story as SQLite above.
        // `TenantMode` refuses to boot a multi-tenant deployment here, which is the real guard.
      },
    });
  }


  /**
   * Fixes two defects in T1's per-tenant settings, both found by probing the running database rather
   * than by reading the code. T1 proved a tenant could not READ another tenant's setting; it never
   * proved a tenant could WRITE its own.
   *
   * DEFECT 1 — `_system_meta`'s primary key is `key` alone, so two tenants can never hold the same
   * setting. The second one to set `site_name` gets
   * `duplicate key value violates unique constraint "_system_meta_pkey"`. Per-tenant settings were
   * structurally impossible; the isolation the T1 suite measured was the isolation of an empty set.
   *
   * DEFECT 2 — precedence was undefined. The T1 policy lets a tenant read platform rows
   * (`tenant_id IS NULL`) as well as its own, and every caller reads with
   * `findOne(META, { key })` → `... WHERE key = $1 LIMIT 1` with no ORDER BY. With a tenant row AND a
   * platform row for one key, which value the site used was down to the planner.
   *
   * The fix for defect 2 is to make the two sets DISJOINT in the database instead of resolving a
   * precedence rule at twenty call sites: a platform row is visible only for the small, fixed list of
   * deployment truths a tenant cannot own, and every other key becomes per-tenant. One key therefore
   * never has two visible rows, and `findOne` is unambiguous again.
   */
  private async v023SettingsIdentity(db: IDatabaseManager): Promise<void> {
    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        await MultiSitePlatformMigration.widenPrimaryKey(db);
        await MultiSitePlatformMigration.giveEachTenantItsOwnRows(db);
        await MultiSitePlatformMigration.narrowPlatformReads(db);
      },
      sqlite: async () => {
        // Nothing to widen: a SQLite deployment serves ONE site, so the key alone is already unique.
        // NOT because of the file-per-tenant silo (S1) — that was designed and never adopted — but
        // because this driver has no tenant isolation at all, so `TenantMode` refuses to boot a
        // second tenant on it. Rebuilding the table to widen a key that cannot collide would be risk
        // with no benefit. If S1 is ever revived, revisit this: the premise changes, not the
        // conclusion.
      },
      mysql: async () => {
        // Same reasoning as SQLite above, word for word: no row-level security on this driver,
        // `TenantMode` refuses a second tenant, so the key alone cannot collide and there is nothing
        // to widen.
      },
    });
  }


  /**
   * Per-tenant plugin enablement.
   *
   * INSTALLATION IS PLATFORM-WIDE; ENABLEMENT IS PER TENANT. One container, one filesystem, one copy
   * of the code — a tenant cannot install code, it can only turn on code the operator already
   * installed. So `_system_plugins` keeps every installation fact (on disk, version, integrity,
   * signature, held) and this table answers only "does tenant T run this plugin".
   *
   * This table is NOT tenant-scoped by row-level security, and that is deliberate rather than an
   * omission — the same rule that keeps `users`, memberships and sessions unscoped. It is read to
   * DECIDE what a tenant may do, including on paths that legitimately read across tenants (the
   * platform-wide plugin list), so a policy here would be circular. It is protected the way
   * `_system_tenants` is: only the framework reads it, never a plugin, and every read passes an
   * explicit tenant id.
   */
  private async v024TenantPlugins(db: IDatabaseManager): Promise<void> {
    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        await MultiSitePlatformMigration.createTableV24(db, 'TIMESTAMP');
        await MultiSitePlatformMigration.backfillFromActivePlugins(db);

        await MultiSitePlatformMigration.scopePluginSettings(db);
      },
      mysql: async () => {
        await MultiSitePlatformMigration.createTableV24(db, 'TIMESTAMP NULL', 'VARCHAR(191)');
        await MultiSitePlatformMigration.backfillFromActivePlugins(db, 'INSERT IGNORE');
        // No row-level security on MySQL, and nothing replaces it — same story as SQLite below.
        // `TenantMode` refuses to boot a multi-tenant deployment here, which is the real guard.
      },
      sqlite: async () => {
        await MultiSitePlatformMigration.createTableV24(db, 'DATETIME');
        await MultiSitePlatformMigration.backfillFromActivePlugins(db);
        // No row-level security on SQLite, and nothing replaces it — the file-per-tenant silo (S1)
        // was designed and NOT adopted; see its spec. Single-site only on this driver.
      },
    });
  }


  /**
   * Per-tenant theme activation.
   *
   * INSTALLATION IS PLATFORM-WIDE; ACTIVATION IS PER TENANT — the same split T2 drew for plugins, for
   * the same reason: one container, one `themes/` directory, one copy of each theme's files. A tenant
   * chooses among what the operator installed; it cannot put files on disk.
   *
   * `_system_themes` (keyed on `slug` alone, one process-wide `active` row) stays exactly as it is and
   * keeps meaning "installed". Adding a `tenant_id` to it would have repeated the `_system_meta` mistake
   * from T1: one row per slug means two tenants could never both activate the same theme.
   *
   * Not tenant-scoped by row-level security — it is in the resolution path (read to decide what a tenant
   * renders with), the framework alone reads it, and every read names the tenant.
   */
  private async v025TenantThemes(db: IDatabaseManager): Promise<void> {
    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        await MultiSitePlatformMigration.createTableV25(db, 'TIMESTAMP', 'JSONB');
        await MultiSitePlatformMigration.backfillFromActiveTheme(db);
      },
      sqlite: async () => {
        await MultiSitePlatformMigration.createTableV25(db, 'DATETIME', 'TEXT');
        await MultiSitePlatformMigration.backfillFromActiveTheme(db);
      },
      mysql: async () => {
        // `key` is VARCHAR(191): "tenant_id"/"theme_slug" carry the composite primary key and
        // "state" carries a DEFAULT, and MySQL allows neither on TEXT. `INSERT IGNORE` stands in for
        // `ON CONFLICT DO NOTHING`, which MySQL does not have.
        await MultiSitePlatformMigration.createTableV25(db, 'TIMESTAMP NULL', 'JSON', 'VARCHAR(191)');
        await MultiSitePlatformMigration.backfillFromActiveTheme(db, 'INSERT IGNORE');
      },
    });
  }


  /**
   * T5c: every isolated plugin runs as its own OS user, and that user has to be the SAME one every
   * time the plugin starts — its data directory is owned by it. The number is assigned once, on the
   * plugin's first isolated start, and kept here. (The theme render hosts share one fixed identity and
   * need no row.)
   *
   * The two theme-render settings (`ssr_render_memory_mb`, `ssr_render_timeout_ms`) joined the platform
   * key list of the `_system_meta` policy at the same time; that list is applied by the boot sweep
   * (`TenantBespokePolicies`), so it needs no statement here.
   */
  private async v026IsolationIdentities(db: IDatabaseManager): Promise<void> {
    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        await db.execute(sql`ALTER TABLE "_system_plugins" ADD COLUMN IF NOT EXISTS "isolation_uid" INTEGER`);
      },
      sqlite: async () => {
        try {
          await db.execute(sql`ALTER TABLE "_system_plugins" ADD COLUMN "isolation_uid" INTEGER`);
        } catch (e: any) {
          const msg: string = (e?.message ?? '') + (e?.cause?.message ?? '');
          if (!msg.includes('duplicate column name')) throw e;
        }
      },
      mysql: async () => {
        await ColumnGuard.addIfMissing(db, '_system_plugins', 'isolation_uid', 'INTEGER');
      },
    });
  }


  /**
   * T6: what a tenant IS. `kind` — `site` (a storefront on its domain, admin on the shared admin host)
   * or `workspace` (its domain serves the admin, locked to `appearance`). Every existing tenant is a
   * site: that is exactly what they have been. The defaults here ARE the declared defaults the create
   * form shows; code never invents another.
   */
  private async v027TenantKinds(db: IDatabaseManager): Promise<void> {
    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        await db.execute(sql`ALTER TABLE "_system_tenants" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'site'`);
        await db.execute(sql`ALTER TABLE "_system_tenants" ADD COLUMN IF NOT EXISTS "appearance" TEXT NOT NULL DEFAULT ''`);
      },
      sqlite: async () => {
        for (const statement of [
          sql`ALTER TABLE "_system_tenants" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'site'`,
          sql`ALTER TABLE "_system_tenants" ADD COLUMN "appearance" TEXT NOT NULL DEFAULT ''`,
        ]) {
          try {
            await db.execute(statement);
          } catch (e: any) {
            const msg: string = (e?.message ?? '') + (e?.cause?.message ?? '');
            if (!msg.includes('duplicate column name')) throw e;
          }
        }
      },
      mysql: async () => {
        // TEXT cannot carry a DEFAULT in MySQL, and both columns do — VARCHAR(191) is plenty for a
        // tenant kind or an appearance slug.
        await ColumnGuard.addIfMissing(db, '_system_tenants', 'kind', "VARCHAR(191) NOT NULL DEFAULT 'site'");
        await ColumnGuard.addIfMissing(db, '_system_tenants', 'appearance', "VARCHAR(191) NOT NULL DEFAULT ''");
      },
    });
  }


  /**
   * Lets a share point at plugin RECORDS, not only at media.
   *
   * The framework already owns everything a public share needs: a hashed per-recipient token, an expiry,
   * a download cap, revocation, and an access log (`_system_file_shares`, `_system_file_grants`,
   * `_system_file_access_log`). What it could not do was share anything other than files, so every plugin
   * that needed "send this record to someone by link" grew its own copy of the same machinery.
   *
   * Two columns fix that. `resource_type` names what is being shared, in the owning plugin's own terms,
   * and `resource_ids` lists which ones. A file share leaves both empty and behaves exactly as before.
   */
  private async v028RecordShares(db: IDatabaseManager): Promise<void> {
    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        await db.execute(sql`ALTER TABLE "_system_file_shares" ADD COLUMN IF NOT EXISTS "resource_type" TEXT NOT NULL DEFAULT ''`);
        await db.execute(sql`ALTER TABLE "_system_file_shares" ADD COLUMN IF NOT EXISTS "resource_ids" TEXT NOT NULL DEFAULT '[]'`);
      },
      sqlite: async () => {
        for (const statement of [
          sql`ALTER TABLE "_system_file_shares" ADD COLUMN "resource_type" TEXT NOT NULL DEFAULT ''`,
          sql`ALTER TABLE "_system_file_shares" ADD COLUMN "resource_ids" TEXT NOT NULL DEFAULT '[]'`,
        ]) {
          try {
            await db.execute(statement);
          } catch (e: any) {
            const msg: string = (e?.message ?? '') + (e?.cause?.message ?? '');
            if (!msg.includes('duplicate column name')) throw e;
          }
        }
      },
      mysql: async () => {
        // "resource_type" is short, so VARCHAR(191) takes the DEFAULT directly (TEXT cannot in
        // MySQL). "resource_ids" is a JSON array that can outgrow 191 characters, so it stays TEXT
        // and takes its default the long way: add it nullable, backfill the existing rows, then lock
        // it to NOT NULL — by which point nothing is left NULL to reject.
        await ColumnGuard.addIfMissing(db, '_system_file_shares', 'resource_type', "VARCHAR(191) NOT NULL DEFAULT ''");
        await ColumnGuard.addIfMissing(db, '_system_file_shares', 'resource_ids', 'TEXT NULL');
        await db.execute(sql`
          UPDATE "_system_file_shares" SET "resource_ids" = '[]' WHERE "resource_ids" IS NULL
        `);
        await db.execute(sql`ALTER TABLE "_system_file_shares" MODIFY COLUMN "resource_ids" TEXT NOT NULL`);
      },
    });
  }


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
  private async v029SinglePlatformOwner(db: IDatabaseManager): Promise<void> {
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
   *    and the theme tables (025) already did. `db.tenantIsolation` supplies the column, its default, the index,
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
  private async v030TenantRedirects(db: IDatabaseManager): Promise<void> {
    await this.reportUnownedRules(db);

    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        await db.tenantIsolation.isolateTable(MultiSitePlatformMigration.TABLE);
        // `scopeUniqueConstraint` is the framework's own helper for exactly this: it drops the
        // single-column constraint and rebuilds it as `(from_path, tenant_id)` under the SAME name, in
        // one statement, so the table is never briefly without a uniqueness rule.
        if (await MultiSitePlatformMigration.hasConstraint(db, MultiSitePlatformMigration.LEGACY_UNIQUE)) {
          await db.tenantIsolation.scopeUniqueConstraint(
            MultiSitePlatformMigration.TABLE, MultiSitePlatformMigration.LEGACY_UNIQUE, ['from_path'],
          );
        }
      },
      sqlite: async () => {
        // No row-level security on SQLite, and nothing replaces it — the file-per-tenant silo (S1)
        // was designed and NOT adopted; see its spec. The column is still added so the two
        // dialects hold the same shape and a row exported from one can be imported into the other.
        await ColumnGuard.addIfMissing(db, MultiSitePlatformMigration.TABLE, TenantColumn.NAME, 'TEXT');
      },
      mysql: async () => {
        // No row-level security on MySQL, and nothing replaces it — same story as SQLite above. The
        // column is still added so the two dialects hold the same shape and a row exported from one
        // can be imported into the other.
        await ColumnGuard.addIfMissing(db, MultiSitePlatformMigration.TABLE, TenantColumn.NAME, 'TEXT');
      },
    });
  }

}

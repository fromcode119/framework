import { DialectHelper } from '@core/database/helpers/dialect';
import { PortableColumnTypes } from '@core/database/helpers/portable-column-types';
import { Logger } from '@core/logging';
import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';

/**
 * A site's lifecycle as the platform sees it.
 *
 * Whether it is open to the public or private until published; who among its own people may preview it
 * before then; whether it is a production site or a copy that must never reach the outside world (no
 * mail, no captures, no bookings); and what each of its hosts answers with — declared, never read out
 * of the host's name.
 *
 * Versions 39, 42, 44 and 52 consolidated. A database that ran them has all four recorded and runs
 * nothing here.
 */
export class SiteLifecycleMigration extends BaseMigration {
  readonly version = 39;
  readonly name = 'Site lifecycle: visibility, preview, environment and host roles';

  async up(db: IDatabaseManager): Promise<void> {
    await this.v039TenantVisibility(db);
    await this.v042SitePreviewGrants(db);
    await this.v044TenantEnvironment(db);
    await this.v052TenantHostRoles(db);
  }

  private static readonly TABLE = '_system_tenants';

  private static readonly logger = new Logger({ namespace: 'SiteLifecycleMigration' });


  /**
   * Whether the column is already there, asked before adding it.
   *
   * `information_schema` is PostgreSQL's; SQLite answers the same question with `PRAGMA table_info`
   * and errors on the other form, which took the whole boot down on that driver.
   */
  private async hasVisibilityColumn(db: IDatabaseManager): Promise<boolean> {
    const { TABLE } = SiteLifecycleMigration;
    let present = false;

    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        present = SiteLifecycleMigration.hasRow(await db.execute(sql.raw(
          `SELECT 1 AS present FROM information_schema.columns
            WHERE table_name = '${TABLE}' AND column_name = 'visibility'`,
        )));
      },
      sqlite: async () => {
        const result: any = await db.execute(sql.raw(`PRAGMA table_info(${TABLE})`));
        const rows: any[] = Array.isArray(result) ? result : (result?.rows ?? []);
        present = rows.some((row: any) => String(row?.name || '') === 'visibility');
      },
      mysql: async () => {
        // Scoped to this schema — `information_schema` spans every database on the server.
        present = SiteLifecycleMigration.hasRow(await db.execute(sql.raw(
          `SELECT 1 AS present FROM information_schema.columns
            WHERE table_schema = DATABASE() AND table_name = '${TABLE}' AND column_name = 'visibility'`,
        )));
      },
    });

    return present;
  }


  private static hasRow(result: any): boolean {
    const rows: any[] = Array.isArray(result) ? result : (result?.rows ?? []);
    return rows.length > 0;
  }

  private static readonly TABLE_V42 = '_system_site_preview_grants';

  private static readonly loggerV42 = new Logger({ namespace: 'SiteLifecycleMigration' });


  private static readonly TABLE_V44 = '_system_tenants';

  private static readonly loggerV44 = new Logger({ namespace: 'SiteLifecycleMigration' });


  /**
   * Whether the column is already there, asked before adding it.
   *
   * `information_schema` is PostgreSQL's; SQLite answers the same question with `PRAGMA table_info`
   * and errors on the other form, which would take the whole boot down on that driver.
   */
  private async hasEnvironmentColumn(db: IDatabaseManager): Promise<boolean> {
    const { TABLE_V44: TABLE } = SiteLifecycleMigration;
    let present = false;

    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        present = SiteLifecycleMigration.hasRowV44(await db.execute(sql.raw(
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
        present = SiteLifecycleMigration.hasRowV44(await db.execute(sql.raw(
          `SELECT 1 AS present FROM information_schema.columns
            WHERE table_schema = DATABASE() AND table_name = '${TABLE}' AND column_name = 'environment'`,
        )));
      },
    });

    return present;
  }


  private static hasRowV44(result: any): boolean {
    const rows: any[] = Array.isArray(result) ? result : (result?.rows ?? []);
    return rows.length > 0;
  }

  private static readonly TABLE_V52 = '_system_tenants';

  private static readonly COLUMN = 'host_roles';

  private static readonly LEGACY_API_PREFIX = 'api.';

  private static readonly loggerV52 = new Logger({ namespace: 'SiteLifecycleMigration' });


  /** JSON on every dialect. Defaulted to an empty object so a row never reads as null. */
  private static async addColumn(db: IDatabaseManager): Promise<void> {
    const { TABLE_V52: TABLE, COLUMN } = SiteLifecycleMigration;
    const columns = await db.getColumns(TABLE);
    if (columns.map((name) => name.toLowerCase()).includes(COLUMN)) return;

    await DialectHelper.executeForDialect(db.dialect, {
      postgres: async () => {
        await db.execute(sql.raw(`ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS "${COLUMN}" JSONB NOT NULL DEFAULT '{}'::jsonb`));
      },
      sqlite: async () => {
        await db.execute(sql.raw(`ALTER TABLE ${TABLE} ADD COLUMN "${COLUMN}" TEXT NOT NULL DEFAULT '{}'`));
      },
      mysql: async () => {
        // MySQL refuses a literal default on JSON, so the column is nullable and the reader treats
        // null as "nothing declared" — the same answer an empty object gives.
        await db.execute(sql.raw(`ALTER TABLE ${TABLE} ADD COLUMN \`${COLUMN}\` JSON NULL`));
      },
    });
  }


  private static readRoles(value: unknown): Record<string, string> {
    if (value && typeof value === 'object' && !Array.isArray(value)) return { ...(value as Record<string, string>) };
    const raw = String(value ?? '').trim();
    if (!raw) return {};
    try {
      const parsed: unknown = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? { ...(parsed as Record<string, string>) } : {};
    } catch {
      return {};
    }
  }


  private static hostsOf(row: Record<string, unknown>): string[] {
    const hosts = [String(row.primary_host ?? '')];
    const aliases = row.host_aliases;

    if (Array.isArray(aliases)) {
      hosts.push(...aliases.map((alias) => String(alias)));
    } else if (typeof aliases === 'string' && aliases.trim().startsWith('[')) {
      try {
        const parsed: unknown = JSON.parse(aliases);
        if (Array.isArray(parsed)) hosts.push(...parsed.map((alias) => String(alias)));
      } catch {
        // A malformed aliases value is not this migration's to repair; the primary host still counts.
      }
    }

    return hosts.map((host) => host.trim().toLowerCase()).filter((host) => host.length > 0);
  }

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
  private async v039TenantVisibility(db: IDatabaseManager): Promise<void> {
    const { TABLE, logger } = SiteLifecycleMigration;

    // Whether the column is being introduced RIGHT NOW decides whether the backfill is safe. If it
    // already exists, every value in it was chosen — by the default or by an operator — and opening
    // those sites would override a decision somebody made. The migration runner records versions and
    // does not re-run, so this is a belt to that brace, not the only guard.
    const existed = await this.hasVisibilityColumn(db);

    // SQLite has neither `information_schema` nor `IF NOT EXISTS` on ADD COLUMN, so both halves of
    // this migration have to be asked in that dialect's own words — which is why `existed` is
    // checked first rather than leaned on as a clause.
    if (!existed) {
      await DialectHelper.executeForDialect(db.dialect, {
        postgres: async () => {
          await db.execute(sql.raw(
            `ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private'`,
          ));
        },
        sqlite: async () => {
          await db.execute(sql.raw(
            `ALTER TABLE ${TABLE} ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private'`,
          ));
        },
        mysql: async () => {
          // Same as SQLite — no IF NOT EXISTS on ADD COLUMN — and the column is short and compared
          // by value, so it is bounded rather than TEXT.
          await db.execute(sql.raw(
            `ALTER TABLE ${TABLE} ADD COLUMN visibility VARCHAR(32) NOT NULL DEFAULT 'private'`,
          ));
        },
      });
    }

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


  /**
   * Somewhere to record that a site's own people may look at it before it is published.
   *
   * `TenantVisibility.PRIVATE` has always PROMISED this — "the site's own admins see the real thing,
   * so it can be built and reviewed before launch" — and the storefront never kept it. It could not:
   * the admin's session cookie is host-scoped, so it is never sent to the site's host, and on a
   * customer's own apex domain there is no shared domain to send it on. The operator got the same
   * holding page as a stranger, on the site they were being asked to build.
   *
   * This table is the handoff. The admin mints a one-time GRANT for one site; the operator's browser
   * spends it on that site's host and gets a SESSION cookie back for the same row. Two secrets, one
   * row, so revoking the row ends both.
   *
   * PLATFORM-LEVEL, NOT TENANT-SCOPED. `_system_` prefixed tables are excluded from row-level security
   * by `TenantScopedTables`, which is required rather than incidental here: the grant is written on
   * the admin host, where the request is bound to whichever site the operator is currently inside —
   * frequently not the one being previewed, and on the Sites registry, not any of them. `tenant_id` is
   * the binding instead, and it is compared on every read.
   *
   * ONLY HASHES ARE STORED. Neither secret can be read back out, so a database copy is not a set of
   * working preview links. Rows are short-lived and the sweep that spends them also drops what has
   * lapsed; nothing here accumulates.
   */
  private async v042SitePreviewGrants(db: IDatabaseManager): Promise<void> {
    const { TABLE_V42: TABLE, loggerV42: logger } = SiteLifecycleMigration;
    const type = PortableColumnTypes.for(db.dialect);

    await db.execute(sql.raw(
      `CREATE TABLE IF NOT EXISTS ${TABLE} (
        id ${type.key} PRIMARY KEY,
        tenant_id ${type.key} NOT NULL,
        user_id ${type.key} NOT NULL,
        token_hash ${type.key} NOT NULL UNIQUE,
        expires_at ${type.timestamp} NOT NULL,
        -- The single-use lock, and NOT NULL for a reason the whole feature rests on: the claim is an
        -- UPDATE whose WHERE says "only if unspent", and on the raw system-table path a null in a
        -- WHERE compiles to an equality against NULL, which matches nothing. consumed_at records
        -- when; this records whether. See SitePreviewGrantState.
        state ${type.shortText} NOT NULL DEFAULT 'issued',
        consumed_at ${type.timestamp} NULL,
        session_hash ${type.key} NULL UNIQUE,
        session_expires_at ${type.timestamp} NULL,
        created_at ${type.timestamp} NOT NULL DEFAULT ${type.now},
        FOREIGN KEY (tenant_id) REFERENCES _system_tenants(id) ON DELETE CASCADE
      )`,
    ));

    // Both secrets are looked up by hash, on the hot path: the session hash is read on every
    // storefront request that carries a preview cookie.
    await db.execute(sql.raw(
      `CREATE INDEX IF NOT EXISTS idx_${TABLE}_session ON ${TABLE} (session_hash)`,
    ));
    // The sweep asks "what has lapsed"; a site's own row set is asked for when access is withdrawn.
    await db.execute(sql.raw(
      `CREATE INDEX IF NOT EXISTS idx_${TABLE}_tenant ON ${TABLE} (tenant_id)`,
    ));

    logger.info(
      `${TABLE} created. No preview is granted by this migration: a site stays closed to everyone `
      + 'until one of its administrators asks for a link.',
    );
  }

  /**
   * A site may be a COPY, and a copy must not reach the outside world.
   *
   * Migrating a live shop onto the platform means standing up a staging site that holds the real thing:
   * real customers, real Stripe keys, real courier credentials, real referral payout config. Nothing stopped
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
  private async v044TenantEnvironment(db: IDatabaseManager): Promise<void> {
    const { TABLE_V44: TABLE, loggerV44: logger } = SiteLifecycleMigration;

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
   * Makes each host's role DECLARED data instead of something read out of its name.
   *
   * The gateway used to decide what a host answers with by looking at the hostname: anything starting
   * `api.` went to the api, and everything else followed the tenant's kind. Nothing said so on any
   * screen. Name a shop's alias `api.shop.com` and it silently stopped being a storefront; want a
   * dedicated api host and you had to know that one prefix was special. A value no admin field
   * produced and no operator could change is precisely what this platform forbids.
   *
   * This adds `host_roles` — host -> role — and then WRITES DOWN what the old rule was already doing,
   * so the upgrade changes no routing anywhere: every existing `api.`-prefixed host gets an explicit
   * `api` role. The behaviour is identical; the difference is that it is now visible and changeable.
   *
   * Every other host is deliberately left out of the map rather than stamped with its default. The
   * default is a real answer — a site's hosts are storefronts, a workspace's are consoles — and
   * writing it against every host would turn one clear rule into rows that drift the moment a tenant's
   * kind changes.
   *
   * IDEMPOTENT. A host already carrying a declared role is never overwritten, and a second run finds
   * nothing to do.
   */
  private async v052TenantHostRoles(db: IDatabaseManager): Promise<void> {
    const { TABLE_V52: TABLE, COLUMN, loggerV52: logger } = SiteLifecycleMigration;

    // A deployment without the tenants table has no tenants to describe.
    let rows: Array<Record<string, unknown>>;
    try {
      await SiteLifecycleMigration.addColumn(db);
      rows = await db.queryRaw(`SELECT id, primary_host, host_aliases, ${COLUMN} FROM ${TABLE}`);
    } catch {
      return;
    }

    let stamped = 0;

    for (const row of rows) {
      const declared = SiteLifecycleMigration.readRoles(row[COLUMN]);
      const legacy = SiteLifecycleMigration.hostsOf(row)
        .filter((host) => host.startsWith(SiteLifecycleMigration.LEGACY_API_PREFIX))
        .filter((host) => !(host in declared));
      if (!legacy.length) continue;

      for (const host of legacy) declared[host] = 'api';
      await db.update(TABLE, { id: row.id }, { [COLUMN]: JSON.stringify(declared) });
      stamped += legacy.length;
      logger.info(`Site ${String(row.id)}: ${legacy.join(', ')} now declares the api role it was being given by its name.`);
    }

    if (stamped > 0) {
      logger.info(`Wrote down ${stamped} host role(s) that the old name-based rule was applying silently.`);
    }
  }

}

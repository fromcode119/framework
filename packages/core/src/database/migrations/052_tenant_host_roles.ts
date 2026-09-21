import { BaseMigration, IDatabaseManager, sql } from '@fromcode119/database';
import { DialectHelper } from '@core/database/helpers/dialect';
import { Logger } from '@core/logging';

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
export class TenantHostRolesMigration extends BaseMigration {
  readonly version = 52;
  readonly name = 'Declare what each tenant host answers with, instead of reading it from the name';

  private static readonly TABLE = '_system_tenants';
  private static readonly COLUMN = 'host_roles';
  private static readonly LEGACY_API_PREFIX = 'api.';
  private static readonly logger = new Logger({ namespace: 'TenantHostRolesMigration' });

  async up(db: IDatabaseManager): Promise<void> {
    const { TABLE, COLUMN, logger } = TenantHostRolesMigration;

    // A deployment without the tenants table has no tenants to describe.
    let rows: Array<Record<string, unknown>>;
    try {
      await TenantHostRolesMigration.addColumn(db);
      rows = await db.queryRaw(`SELECT id, primary_host, host_aliases, ${COLUMN} FROM ${TABLE}`);
    } catch {
      return;
    }

    let stamped = 0;

    for (const row of rows) {
      const declared = TenantHostRolesMigration.readRoles(row[COLUMN]);
      const legacy = TenantHostRolesMigration.hostsOf(row)
        .filter((host) => host.startsWith(TenantHostRolesMigration.LEGACY_API_PREFIX))
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

  /** JSON on every dialect. Defaulted to an empty object so a row never reads as null. */
  private static async addColumn(db: IDatabaseManager): Promise<void> {
    const { TABLE, COLUMN } = TenantHostRolesMigration;
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
}

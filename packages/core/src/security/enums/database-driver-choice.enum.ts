import { Enum } from '@fromcode119/react-class-components';

/**
 * The database drivers the first-run wizard can offer, and what each one can actually do.
 *
 * The wizard lists ALL of them, including the one that cannot be picked, because a driver that is
 * simply absent from a menu reads as a driver that does not exist — and the honest answer is that it
 * exists and is not finished. What it must never do is offer a choice whose consequence is invisible:
 * picking a driver here decides, permanently, whether this installation can ever host a second site.
 *
 * `isolatesTenants` is the load-bearing one. Tenancy in this platform is ONE database with every row
 * tagged `tenant_id`, isolated by Postgres row-level security — there is no per-tenant database and
 * no per-tenant schema anywhere in the codebase. So a driver without row-level security is not a
 * slower way to be multi-tenant, it is single-site only, and `TenantMode.configure` refuses to boot
 * the moment a second tenant appears on one rather than serving every tenant to every other tenant.
 *
 * These flags mirror the dialect implementations rather than deciding anything themselves; the test
 * beside this file asserts they still agree, so a driver that gains isolation cannot be left saying
 * it has none.
 */
export class DatabaseDriverChoice extends Enum {
  /** Row-level security, three roles, backups. The only driver that can host more than one site. */
  static readonly POSTGRES = new DatabaseDriverChoice('postgres', { isolatesTenants: true, isAvailable: true });

  /**
   * One file, one site, and no database server to run.
   *
   * Installable — 039 through 042 had PostgreSQL-only spellings that took the first boot down, and
   * they now resolve their column types per dialect. What is NOT fixable is the isolation: SQLite has
   * no row-level security, and tenancy here is one database with rows tagged `tenant_id`, so there is
   * nowhere to put a second site's rows. That limit is architectural, not unfinished work.
   */
  static readonly SQLITE = new DatabaseDriverChoice('sqlite', { isolatesTenants: false, isAvailable: true });

  /**
   * Real roles, no isolation, no backup handler and no tests — so it cannot be picked.
   *
   * Its limit is unfinished work rather than anything structural, which is what separates it from
   * SQLite: MySQL could gain an isolation strategy and host many sites, while SQLite has nowhere to
   * put a second site's rows however much work it gets.
   */
  static readonly MYSQL = new DatabaseDriverChoice('mysql', { isolatesTenants: false, isAvailable: false });

  readonly isolatesTenants: boolean;
  readonly isAvailable: boolean;

  private constructor(value: string, capabilities: { isolatesTenants: boolean; isAvailable: boolean }) {
    super(value);
    this.isolatesTenants = capabilities.isolatesTenants;
    this.isAvailable = capabilities.isAvailable;
  }

  /** In the order the wizard shows them: what it recommends first, what it will not let you pick last. */
  static get ordered(): DatabaseDriverChoice[] {
    return [DatabaseDriverChoice.POSTGRES, DatabaseDriverChoice.SQLITE, DatabaseDriverChoice.MYSQL];
  }

  /** Strict: an unknown value is `undefined`, never a guessed driver. */
  static parse(value: unknown): DatabaseDriverChoice | undefined {
    if (value instanceof DatabaseDriverChoice) return value;
    return DatabaseDriverChoice.fromValue(String(value ?? '').trim().toLowerCase()) as DatabaseDriverChoice | undefined;
  }

  /**
   * For a caller that already holds a driver and needs its capabilities — an unknown value throws
   * rather than resolving to a default, because every default here is somebody's isolation.
   */
  static from(value: unknown): DatabaseDriverChoice {
    const parsed = DatabaseDriverChoice.parse(value);
    if (!parsed) throw new Error(`DatabaseDriverChoice: "${String(value)}" is not a driver this platform ships.`);
    return parsed;
  }

  /** True when choosing this driver means the installation can never host a second site. */
  get isSingleSiteOnly(): boolean {
    return !this.isolatesTenants;
  }
}

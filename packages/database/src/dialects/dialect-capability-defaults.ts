import { DatabaseRoleOutcome } from '@database/roles/database-role-outcome';
import type { DatabaseRolePlan } from '@database/roles/database-role-plan';
import { SchemaReconcileOutcome } from '@database/schema-reconcile-outcome';
import { RefusingTenantIsolation } from '@database/tenant/refusing-tenant-isolation';
import { BlindSchemaIntrospection } from '@database/introspection/blind-schema-introspection';
import type { ITenantIsolation } from '@database/interfaces/tenant-isolation.interface';
import type { ISchemaIntrospection } from '@database/interfaces/schema-introspection.interface';
import type { IColumnStats } from '@database/interfaces/column-stats.interface';

/**
 * What a driver can do, and the honest answer when it cannot.
 *
 * Every member here is the DEFAULT for a capability some drivers lack: row-level security, role
 * provisioning, catalog introspection, re-typing a column in place, an advisory lock. A driver that
 * supports one overrides it; a driver that does not inherits an answer that SAYS so — which is what
 * keeps callers from testing the dialect by name, the drift that had put
 * `if (db.dialect !== 'postgres')` inside a migration base class.
 *
 * THREE DIFFERENT DEFAULTS, and the difference is deliberate:
 *   - isolation REFUSES (`RefusingTenantIsolation` throws), because a driver that silently does not
 *     isolate is a driver that silently leaks, and that must be impossible to use by accident;
 *   - introspection returns EMPTY (`BlindSchemaIntrospection`), because it feeds an export, where
 *     "this driver reports no tables" is truthful and harmless;
 *   - reconciliation REPORTS `unsupported`, because a table that cannot take a constraint is a fact
 *     to surface, not a reason to refuse the boot.
 *
 * Split from `BaseDialect`, which was 684 lines holding this next to a query compiler. These members
 * call nothing else in the class — the seam only became obvious once the SQL halves had been
 * composed out into their own collaborators.
 */
export abstract class DialectCapabilityDefaults {
  /**
   * Marks this connection as the PLATFORM's own — the one that runs migrations and schema sync.
   *
   * Such a connection is never serving a tenant request, and it legitimately writes deployment-level
   * rows (schema fingerprints and the like) that belong to no tenant. Default is a no-op: a driver
   * without row-level security has nothing to mark.
   */
  markAsPlatformConnection(): void {
    // no-op
  }

  /**
   * Whether this driver can actually isolate tenants. Default FALSE.
   *
   * The default is deliberately the refusing one. An earlier version of this class returned a
   * permissive passthrough, which meant any driver that did not override it — MySQL, and every
   * future driver — silently ran with NO isolation and no error: every tenant reading every other
   * tenant's rows, looking perfectly healthy. A base class must not hand out a security property
   * nobody implemented.
   */
  supportsTenantIsolation(): boolean {
    return false;
  }

  /**
   * The refusing implementation, for the same reason `supportsTenantIsolation` defaults to false: a
   * base class must not hand out a security property nobody implemented. A driver with row-level
   * security overrides this with a real one.
   */
  readonly tenantIsolation: ITenantIsolation = new RefusingTenantIsolation(this.constructor.name);

  readonly introspection: ISchemaIntrospection = new BlindSchemaIntrospection();

  /**
   * No catalog to interrogate and no way to add the constraint after the fact, so this REPORTS
   * rather than throwing — nothing is unsafe about a driver that cannot reconcile a declared unique,
   * unlike isolation, where silence would be mistaken for protection.
   */
  /**
   * Nothing, by default. Re-typing a column in place is not portable — SQLite cannot do it at all —
   * and a driver silently doing nothing is the honest answer here: the builder emits the key
   * correctly now, so only databases created by the old builder carry the broken shape.
   */
  async repairTextIdPrimaryKey(_table: string): Promise<void> {
    return undefined;
  }

  async ensureDeclaredUnique(_table: string, _column: string): Promise<SchemaReconcileOutcome> {
    return SchemaReconcileOutcome.unsupported(
      `${this.constructor.name}: this driver cannot reconcile a declared UNIQUE on an existing column.`,
    );
  }

  /**
   * No catalog to read, so nothing is claimed about the column.
   *
   * Zero rows would be a LIE that reads as "safe to drop" — the one answer that must never be
   * invented. A driver that cannot count says so by refusing.
   */
  async columnStats(_table: string, _column: string): Promise<IColumnStats> {
    throw new Error(
      `${this.constructor.name}: this driver cannot report column statistics, so there is nothing to `
      + 'show an operator deciding whether a column is safe to drop. Refusing rather than reporting zero.',
    );
  }

  /** Irreversible, so a driver without an implementation refuses rather than silently doing nothing. */
  async dropColumn(_table: string, _column: string): Promise<void> {
    throw new Error(`${this.constructor.name}: this driver cannot drop a column.`);
  }

  /** A driver that cannot convert a column's type REPORTS rather than throws. */
  async ensurePointInTimeColumn(_table: string, _column: string): Promise<SchemaReconcileOutcome> {
    return SchemaReconcileOutcome.unsupported(
      `${this.constructor.name}: this driver does not convert text date columns.`,
    );
  }

  /** A driver that cannot add a column default REPORTS rather than throws. */
  async ensureTimestampDefault(_table: string, _column: string): Promise<SchemaReconcileOutcome> {
    return SchemaReconcileOutcome.unsupported(
      `${this.constructor.name}: this driver cannot add a default to an existing column.`,
    );
  }

  /** Same contract as `ensureDeclaredUnique`: a driver that cannot answer REPORTS rather than throws. */
  async ensureDeclaredNullable(_table: string, _column: string): Promise<SchemaReconcileOutcome> {
    return SchemaReconcileOutcome.unsupported(
      `${this.constructor.name}: this driver cannot relax a NOT NULL on an existing column.`,
    );
  }

  /**
   * Runs `fn` with every statement bound to `tenantId`.
   *
   * Overridden per driver by its isolation strategy — Postgres holds a pooled client with
   * `app.tenant_id` set (see TenantConnectionScope); a separate-database driver would bind that
   * tenant's connection. A driver that has not implemented one REFUSES rather than running `fn`
   * unisolated.
   *
   * This is never reached on a single-tenant deployment: TenantMode leaves tenancy off entirely, so
   * no tenant scope is opened and drivers without a strategy keep working exactly as before.
   */
  async withTenant<T>(_tenantId: string, _fn: () => Promise<T>): Promise<T> {
    throw new Error(
      `${this.constructor.name}: this driver has no tenant isolation strategy, so a tenant-scoped `
      + 'request cannot be served safely. Refusing rather than running the query unisolated.',
    );
  }

  /** No row-level security here, so there is nothing to lift: `fn` runs as is. */
  async withPlatformAdmin<T>(fn: () => Promise<T>): Promise<T> {
    return fn();
  }

  /**
   * A driver that cannot serialise callers REFUSES, exactly as `withTenant` does.
   *
   * Running `fn` anyway would look like it worked and quietly permit the race the caller asked to be
   * protected from — and the first caller of this is first-administrator creation, where losing that
   * race means two administrators nobody intended.
   */
  async withExclusiveLock<T>(name: string, _fn: () => Promise<T>): Promise<T> {
    throw new Error(
      `${this.constructor.name}: this driver has no exclusive-lock strategy, so "${name}" cannot be `
      + 'serialised. Refusing rather than running it unprotected.',
    );
  }

  /**
   * A driver with no login system reports that, rather than throwing.
   *
   * Unlike `withExclusiveLock` above — where carrying on unprotected would permit the race the caller
   * asked to be prevented — there is nothing unsafe about a database that has no roles to create. SQLite
   * is the case: its access boundary is the database file's permissions, and it also cannot isolate
   * tenants, so a deployment that needs a least-privilege runtime role is already refused elsewhere.
   */
  async provisionRoles(_plan: DatabaseRolePlan): Promise<DatabaseRoleOutcome> {
    return DatabaseRoleOutcome.unsupported(
      `${this.constructor.name}: this driver has no login system, so there are no roles to provision. `
      + 'Access is controlled outside the database.',
    );
  }

  /** Nothing to grant where there are no roles to grant to. */
  async grantRuntimePrivileges(_role: string): Promise<DatabaseRoleOutcome> {
    return DatabaseRoleOutcome.unsupported(
      `${this.constructor.name}: this driver has no login system, so there are no privileges to grant.`,
    );
  }
}

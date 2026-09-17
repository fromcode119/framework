import { TenantIsolationSql } from '@database/dialects/postgres/tenant/tenant-isolation-sql';
import type { ITenantSessionBinding } from '@database/dialects/postgres/tenant/interfaces/tenant-session-binding.interface';
import type { IPostgresQueryable } from '@database/dialects/postgres/tenant/interfaces/postgres-queryable.interface';

/**
 * Binds and clears the tenancy markers on ONE pooled client.
 *
 * Session-scoped (`set_config(..., false)`), not `SET LOCAL`, so the binding survives across
 * statements on a held client rather than expiring with a transaction.
 *
 * Separate from `ITenantIsolation` because it is not a capability a caller outside this package ever
 * reaches for: it takes a raw `pg` client, and the only things holding one are the connection scope,
 * the one-shot client and the pool's own connect handler — all of which live beside this file. The
 * clearing half is what makes the `nullif` guard in the policy load-bearing: released connections
 * are reset to `''`, and `''` must never match a tenant.
 */
export class PostgresTenantSession {
  /** Sets the markers the binding asks for. A binding with neither leaves the client untenanted. */
  static async bind(client: IPostgresQueryable, binding: ITenantSessionBinding): Promise<void> {
    if (binding.tenantId) await client.query(TenantIsolationSql.setTenantStatement(), [binding.tenantId]);
    if (binding.platformAdmin) await client.query(TenantIsolationSql.setPlatformAdminStatement(), ['on']);
  }

  /**
   * Clears BOTH markers, always together — then restores the pool's RESTING state.
   *
   * The platform-admin marker must never outlive the request that earned it, and a client goes back
   * to a shared pool, so clearing the tenant while leaving the marker would hand the next borrower a
   * connection that may write platform rows.
   *
   * `platformPool` is what stops that rule breaking the DDL pool. `markAsPlatformConnection` sets the
   * marker on the pool's `connect` event — i.e. ONCE per physical connection — so a client that had
   * been through any scope came back with the marker off, and `connect` does not fire again on
   * reuse. Every later untenanted platform write on that client was then refused: "new row violates
   * row-level security policy for _system_meta", from code that had done nothing wrong and had no
   * way to see why. Restoring the resting state here is what makes the pool's own promise — every
   * client it hands out acts for the platform — actually true.
   */
  static async clear(client: IPostgresQueryable, platformPool = false): Promise<void> {
    await client.query(TenantIsolationSql.resetTenantStatement());
    if (platformPool) {
      await client.query(TenantIsolationSql.setPlatformAdminStatement(), ['on']);
      return;
    }
    await client.query(TenantIsolationSql.resetPlatformAdminStatement());
  }

  /**
   * Marks a client as the PLATFORM's own, fire-and-forget.
   *
   * Used from the pool's `connect` event, where there is nothing to await into and a failure must
   * not take the connection down.
   */
  static markPlatformAdmin(client: IPostgresQueryable): void {
    client.query(TenantIsolationSql.setPlatformAdminStatement(), ['on']).catch(() => undefined);
  }
}


import { TenantIsolationSql } from '@database/dialects/postgres/tenant/tenant-isolation-sql';

/** What a connection is acting as, for the duration it is held. */
export interface ITenantSessionBinding {
  tenantId?: string | null;
  platformAdmin?: boolean;
}

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
  static async bind(client: PostgresQueryable, binding: ITenantSessionBinding): Promise<void> {
    if (binding.tenantId) await client.query(TenantIsolationSql.setTenantStatement(), [binding.tenantId]);
    if (binding.platformAdmin) await client.query(TenantIsolationSql.setPlatformAdminStatement(), ['on']);
  }

  /**
   * Clears BOTH markers, always together.
   *
   * The platform-admin marker must never outlive the request that earned it, and a client goes back
   * to a shared pool — so clearing the tenant while leaving the marker would hand the next borrower
   * a connection that may write platform rows.
   */
  static async clear(client: PostgresQueryable): Promise<void> {
    await client.query(TenantIsolationSql.resetTenantStatement());
    await client.query(TenantIsolationSql.resetPlatformAdminStatement());
  }

  /**
   * Marks a client as the PLATFORM's own, fire-and-forget.
   *
   * Used from the pool's `connect` event, where there is nothing to await into and a failure must
   * not take the connection down.
   */
  static markPlatformAdmin(client: PostgresQueryable): void {
    client.query(TenantIsolationSql.setPlatformAdminStatement(), ['on']).catch(() => undefined);
  }
}

/** The only thing this needs of a `pg` client, so tests can pass a recorder. */
export interface PostgresQueryable {
  query(text: string, values?: unknown[]): Promise<unknown>;
}

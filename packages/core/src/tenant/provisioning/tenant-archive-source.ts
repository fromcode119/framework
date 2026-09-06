import type { IDatabaseManager } from '@fromcode119/database';

/**
 * Where an export reads from.
 *
 *  - `tenant`: one tenant of a multi-tenant platform. Read inside `withTenant(id)` on the OWNER
 *    connection, so row-level security scopes every statement AND the explicit `tenant_id` filter
 *    states the intent. FORCE applies to the owner; the scope is what makes the read return anything.
 *  - `single-tenant`: a whole deployment that has no tenants (the local `app.db`, production before
 *    adoption). Rows whose `tenant_id` is NULL or whose table has no such column. Opened read-only by
 *    the caller — this class never writes.
 *
 * `uploadsDir` is that deployment's uploads root; the writer copies the files `media` rows point at.
 */
export class TenantArchiveSource {
  private constructor(
    readonly db: IDatabaseManager,
    readonly kind: 'tenant' | 'single-tenant',
    readonly tenantId: string | null,
    readonly uploadsDir: string,
  ) {}

  static tenant(db: IDatabaseManager, tenantId: string, uploadsDir: string): TenantArchiveSource {
    const id = String(tenantId ?? '').trim();
    if (!id) throw new Error('TenantArchiveSource.tenant: empty tenant id.');
    return new TenantArchiveSource(db, 'tenant', id, uploadsDir);
  }

  static singleTenant(db: IDatabaseManager, uploadsDir: string): TenantArchiveSource {
    return new TenantArchiveSource(db, 'single-tenant', null, uploadsDir);
  }

  get isTenant(): boolean {
    return this.kind === 'tenant';
  }

  /** Runs `fn` under the tenant's row-level-security scope when there is a tenant; plainly otherwise. */
  async scoped<T>(fn: () => Promise<T>): Promise<T> {
    if (this.isTenant && this.tenantId) return this.db.withTenant(this.tenantId, fn);
    return fn();
  }
}

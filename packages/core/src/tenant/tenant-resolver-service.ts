import { SystemConstants } from '@core/constants/system.constants';
import { TenantRecord } from '@core/tenant/tenant-record';

/**
 * Host → tenant.
 *
 * Framework-owned: `_system_tenants` is a system table and no plugin reads it. It is also the one
 * table that is never tenant-scoped, because it is what RESOLVES tenancy — it has to be readable
 * before a tenant is known.
 *
 * The map is cached because it is consulted on every request, and it is invalidated EXPLICITLY on
 * tenant writes rather than expiring on a timer. A silently stale map would route one customer's
 * traffic into another customer's tenant, so staleness has to be impossible, not merely brief.
 */
export class TenantResolverService {
  private static instance: TenantResolverService | null = null;

  private cache: Map<string, TenantRecord> | null = null;

  constructor(private readonly db: any) {}

  /**
   * THE process's resolver. The request middleware routes with it and the tenant registry
   * invalidates it — one instance by construction, because a second one with its own cache would
   * keep routing by yesterday's hosts after a tenant was created or re-pointed, and nothing would say so.
   */
  static shared(db: any): TenantResolverService {
    if (!TenantResolverService.instance) TenantResolverService.instance = new TenantResolverService(db);
    return TenantResolverService.instance;
  }

  /** Test seam. */
  static resetShared(): void {
    TenantResolverService.instance = null;
  }

  /**
   * The tenant owning `host`, or null.
   *
   * Null means REFUSE. It never falls back to a default tenant, and a SUSPENDED tenant is still
   * returned so the caller can distinguish "suspended" from "domain not configured" — two very
   * different things to put in front of an operator.
   */
  async resolveByHost(host: string): Promise<TenantRecord | null> {
    const needle = String(host ?? '').trim().toLowerCase();
    if (!needle) return null;
    const map = await this.hostMap();
    return map.get(needle) ?? null;
  }

  /** The tenant with this id, or null. Used by the admin surface, which resolves by id not host. */
  async resolveById(tenantId: string): Promise<TenantRecord | null> {
    const needle = String(tenantId ?? '').trim();
    if (!needle) return null;
    const map = await this.hostMap();
    for (const tenant of map.values()) {
      if (tenant.id === needle) return tenant;
    }
    return null;
  }

  /** Call after any write to `_system_tenants`. */
  invalidate(): void {
    this.cache = null;
  }

  private async hostMap(): Promise<Map<string, TenantRecord>> {
    if (this.cache) return this.cache;
    const rows: Array<Record<string, unknown>> = await this.db.find(SystemConstants.TABLE.TENANTS, {});
    const map = new Map<string, TenantRecord>();
    for (const row of rows ?? []) {
      const tenant = TenantRecord.from(row);
      for (const host of tenant.hosts()) {
        map.set(host, tenant);
      }
    }
    this.cache = map;
    return map;
  }
}

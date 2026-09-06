import { CoercionUtils } from '@core/coercion-utils';
import { SystemConstants } from '@core/constants/system.constants';
import { PluginTenantAccess } from '@core/plugin/tenant/plugin-tenant-access';
import { TenantThemeAccess } from '@core/theme/tenant-theme-access';
import { TenantRecord } from '@core/tenant/tenant-record';
import { TenantResolverService } from '@core/tenant/tenant-resolver-service';
import { TenantIdentity } from '@core/tenant/provisioning/tenant-identity';

/**
 * The writer of `_system_tenants` — the one `TenantResolverService` never had.
 *
 * Every write here ends in `invalidate()` on the LIVE resolver (the instance the request middleware
 * routes with), plus the per-tenant plugin and theme caches. That is what makes "no restart" true
 * for tenant changes: a second resolver with its own cache would have routed one customer's traffic
 * by yesterday's hosts until someone restarted the api.
 *
 * Uniqueness of hosts is checked ACROSS primary hosts and aliases of every tenant, not only against
 * the UNIQUE constraint on `primary_host`: an alias colliding with another tenant's primary host is
 * exactly the ambiguity the routing table must never contain.
 */
export class TenantRegistryService {
  constructor(private readonly db: any, private readonly resolver: TenantResolverService) {}

  async list(): Promise<TenantRecord[]> {
    const rows: Array<Record<string, unknown>> = await this.db.find(SystemConstants.TABLE.TENANTS, { orderBy: { slug: 'asc' } });
    return (rows ?? []).map((row) => TenantRecord.from(row));
  }

  async get(id: string): Promise<TenantRecord | null> {
    const row = await this.db.findOne(SystemConstants.TABLE.TENANTS, { id: CoercionUtils.toString(id).trim() });
    return row ? TenantRecord.from(row) : null;
  }

  async count(): Promise<number> {
    return (await this.list()).length;
  }

  /** Refuses ids, slugs and hosts already taken. `exceptId` lets an update keep its own values. */
  async assertAvailable(identity: TenantIdentity, exceptId: string | null = null): Promise<void> {
    const others = (await this.list()).filter((tenant) => tenant.id !== exceptId);
    if (others.some((tenant) => tenant.id === identity.id)) throw new Error(`A tenant with id "${identity.id}" already exists.`);
    if (others.some((tenant) => tenant.slug === identity.slug)) throw new Error(`A tenant with slug "${identity.slug}" already exists.`);
    const taken = new Map<string, string>();
    for (const tenant of others) for (const host of tenant.hosts()) taken.set(host, tenant.slug);
    for (const host of identity.hosts) {
      const owner = taken.get(host);
      if (owner) throw new Error(`Host "${host}" already routes to tenant "${owner}".`);
    }
  }

  async create(identity: TenantIdentity): Promise<TenantRecord> {
    await this.assertAvailable(identity);
    await this.db.insert(SystemConstants.TABLE.TENANTS, {
      id: identity.id,
      slug: identity.slug,
      primary_host: identity.primaryHost,
      host_aliases: JSON.stringify(identity.hostAliases),
      state: identity.state,
      kind: identity.kind.value,
      appearance: identity.appearance,
      created_at: new Date(),
      updated_at: new Date(),
    });
    this.invalidate(identity.id);
    const created = await this.get(identity.id);
    if (!created) throw new Error(`Tenant "${identity.id}" was not found after insert.`);
    return created;
  }

  /** The kind never changes after creation (it decides routing and login); the appearance of a workspace may. */
  async update(id: string, patch: { slug?: unknown; primaryHost?: unknown; hostAliases?: unknown; state?: unknown; appearance?: unknown }): Promise<TenantRecord> {
    const current = await this.get(id);
    if (!current) throw new Error(`Tenant "${id}" does not exist.`);
    const identity = TenantIdentity.from({
      id: current.id,
      slug: patch.slug ?? current.slug,
      primaryHost: patch.primaryHost ?? current.primaryHost,
      hostAliases: patch.hostAliases ?? current.hostAliases,
      state: patch.state ?? current.state,
      kind: current.kind,
      appearance: patch.appearance ?? current.appearance,
    });
    await this.assertAvailable(identity, current.id);
    await this.db.update(SystemConstants.TABLE.TENANTS, { id: current.id }, {
      slug: identity.slug,
      primary_host: identity.primaryHost,
      host_aliases: JSON.stringify(identity.hostAliases),
      state: identity.state,
      appearance: identity.appearance,
      updated_at: new Date(),
    });
    this.invalidate(current.id);
    const updated = await this.get(current.id);
    if (!updated) throw new Error(`Tenant "${current.id}" was not found after update.`);
    return updated;
  }

  /** Removes the registry row and the tenant's configuration rows. Tenant DATA is `TenantEraser`'s job, and runs first. */
  async remove(id: string): Promise<void> {
    const tenantId = CoercionUtils.toString(id).trim();
    if (!tenantId) return;
    await this.db.delete(SystemConstants.TABLE.TENANT_PLUGINS, { tenant_id: tenantId });
    await this.db.delete(SystemConstants.TABLE.TENANT_THEMES, { tenant_id: tenantId });
    await this.db.delete(SystemConstants.TABLE.TENANT_MEMBERSHIPS, { tenant_id: tenantId });
    await this.db.delete(SystemConstants.TABLE.TENANTS, { id: tenantId });
    this.invalidate(tenantId);
  }

  private invalidate(tenantId: string): void {
    this.resolver.invalidate();
    PluginTenantAccess.invalidate(tenantId);
    TenantThemeAccess.invalidate(tenantId);
  }
}

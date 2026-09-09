import { TenantRecord, TenantRegistryService } from '@fromcode119/core';

/**
 * Resolving a tenant by id, or failing loudly.
 *
 * Extracted 2026-09-09 so TenantAdminService, TenantMembersService and TenantPagesService share ONE
 * implementation instead of three copies of the same five lines.
 */
export class TenantLookup {
  constructor(private readonly registry: TenantRegistryService) {}

  async requireTenant(id: string): Promise<TenantRecord> {
    const tenant = await this.registry.get(id);
    if (!tenant) throw new Error(`Tenant "${id}" was not found.`);
    return tenant;
  }
}

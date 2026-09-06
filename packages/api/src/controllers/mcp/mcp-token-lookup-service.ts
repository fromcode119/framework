import { TenantMode } from '@fromcode119/core';
import type { TenantRecord } from '@fromcode119/core';
import { McpTokenRecord } from '@api/controllers/mcp/mcp-token-record';
import { McpTokenStore } from '@api/controllers/mcp/mcp-token-store';

/**
 * Raw api key -> the token it names, found BEFORE any site is bound to the request.
 *
 * Order is the trust order and the cost order. The platform partition holds every token issued
 * since tokens recorded their site (and every pre-tenancy row, whose tenant is NULL). Only when that
 * misses, and only in a multi-site deployment, are the sites' own partitions tried — that is where a
 * token issued by a site's admin before this change still lives. The site that holds it is remembered
 * per key hash, so the sweep across sites happens once per process, not once per request; the row is
 * still re-read every time, so a revoked legacy token stops working immediately.
 */
export class McpTokenLookupService {
  private readonly legacyHomes = new Map<string, string>();

  constructor(
    private readonly store: McpTokenStore,
    private readonly listTenants: () => Promise<TenantRecord[]>,
  ) {}

  async find(rawKey: string): Promise<McpTokenRecord | null> {
    const key = String(rawKey || '').trim();
    if (!key) return null;
    const hash = McpTokenStore.hash(key);

    const platform = McpTokenRecord.fromRow(await this.store.readPlatformRow(hash), null, false);
    if (platform) return platform;
    if (!TenantMode.isEnabled()) return null;

    const remembered = this.legacyHomes.get(hash);
    if (remembered) {
      const record = McpTokenRecord.fromRow(await this.store.readTenantRow(remembered, hash), remembered, true);
      if (record) return record;
      this.legacyHomes.delete(hash);
    }

    for (const tenant of await this.listTenants()) {
      const record = McpTokenRecord.fromRow(await this.store.readTenantRow(tenant.id, hash), tenant.id, true);
      if (!record) continue;
      this.legacyHomes.set(hash, tenant.id);
      return record;
    }
    return null;
  }
}

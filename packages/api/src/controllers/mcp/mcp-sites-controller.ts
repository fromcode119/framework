import { TenantMode } from '@fromcode119/core';
import type { TenantRecord } from '@fromcode119/core';
import { McpTokenRecord } from '@api/controllers/mcp/mcp-token-record';

/**
 * `GET /mcp/sites` — the sites the calling token may act on, and which one this request is bound to.
 *
 * The ONE token route an all-sites token may call without naming a site: it is how a client learns
 * what to name. A site-bound token gets exactly its site. Ids and hosts only — nothing a token
 * holder could not already see by acting on the site.
 */
export class McpSitesController {
  constructor(private readonly tenants: { list(): Promise<TenantRecord[]>; get(id: string): Promise<TenantRecord | null> }) {}

  async list(req: any, res: any): Promise<void> {
    if (!TenantMode.isEnabled()) {
      res.json({ multiTenant: false, current: null, sites: [] });
      return;
    }
    const token = req?.apiToken instanceof McpTokenRecord ? req.apiToken : null;
    if (!token) {
      res.status(401).json({ error: 'Unauthorized: missing or invalid token' });
      return;
    }
    const all = token.allSites ? await this.tenants.list() : [await this.tenants.get(token.tenantId as string)];
    const sites = all
      .filter((tenant): tenant is TenantRecord => Boolean(tenant) && (tenant as TenantRecord).isActive)
      .map((tenant) => ({ id: tenant.id, slug: tenant.slug, host: tenant.primaryHost }));
    res.json({ multiTenant: true, allSites: token.allSites, current: String(req?.tenantId || '') || null, sites });
  }
}

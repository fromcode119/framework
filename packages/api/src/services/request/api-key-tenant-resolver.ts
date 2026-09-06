import { McpWirePaths } from '@fromcode119/mcp';
import type { TenantRecord } from '@fromcode119/core';
import { McpTokenLookupService } from '@api/controllers/mcp/mcp-token-lookup-service';
import { McpTokenRecord } from '@api/controllers/mcp/mcp-token-record';

/**
 * Which site an API-KEY request acts in.
 *
 * A machine client has no browser Origin and its Host is the shared api host, so neither can name
 * the site — and neither may: a header any client can set must never choose whose data a key reads.
 * The TOKEN chooses. A token bound to a site acts on that site, full stop. An all-sites (platform)
 * token names its site per request in `McpWirePaths.SITE_HEADER`; the header selects among the sites
 * the token already reaches, it grants nothing.
 *
 * Fail-closed like the other resolvers: no token, no site; a header that disagrees with a bound
 * token is refused, never silently redirected to the token's site.
 */
export class ApiKeyTenantResolver {
  static readonly KEY_HEADER = 'x-api-key';

  constructor(
    private readonly lookup: McpTokenLookupService,
    private readonly tenants: { resolveById(id: string): Promise<TenantRecord | null>; resolveByHost(host: string): Promise<TenantRecord | null> },
  ) {}

  static hasKey(req: any): boolean {
    return Boolean(String(req?.headers?.[ApiKeyTenantResolver.KEY_HEADER] ?? '').trim());
  }

  /** The token is published on `req.apiToken` so the auth layer authenticates the SAME record. */
  async resolve(req: any): Promise<{ tenant: TenantRecord | null; reason?: 'invalid_token' | 'site_required' | 'unknown_site' | 'site_mismatch' }> {
    const record = await this.lookup.find(String(req?.headers?.[ApiKeyTenantResolver.KEY_HEADER] ?? ''));
    if (!record || record.isExpired) return { tenant: null, reason: 'invalid_token' };
    req.apiToken = record;

    const requested = String(req?.headers?.[McpWirePaths.SITE_HEADER] ?? '').trim().toLowerCase();
    if (!record.allSites) {
      const tenant = await this.tenants.resolveById(record.tenantId as string);
      if (!tenant) return { tenant: null, reason: 'unknown_site' };
      if (requested && !ApiKeyTenantResolver.names(tenant, requested)) return { tenant: null, reason: 'site_mismatch' };
      return { tenant };
    }

    if (!requested) return { tenant: null, reason: 'site_required' };
    const tenant = (await this.tenants.resolveById(requested)) ?? (await this.tenants.resolveByHost(requested));
    return tenant ? { tenant } : { tenant: null, reason: 'unknown_site' };
  }

  static tokenOf(req: any): McpTokenRecord | null {
    return req?.apiToken instanceof McpTokenRecord ? req.apiToken : null;
  }

  private static names(tenant: TenantRecord, value: string): boolean {
    return tenant.id.toLowerCase() === value || tenant.slug.toLowerCase() === value || tenant.primaryHost.toLowerCase() === value
      || tenant.hostAliases.some((alias) => alias.toLowerCase() === value);
  }
}

import { Logger, RequestContextUtils, TenantRegistryService, TenantResolverService } from '@fromcode119/core';
import { McpWirePaths } from '@fromcode119/mcp';
import { ApiKeyTenantResolver } from '@api/services/request/api-key-tenant-resolver';
import { McpTokenLookupService } from '@api/controllers/mcp/mcp-token-lookup-service';
import { McpTokenStore } from '@api/controllers/mcp/mcp-token-store';
import { McpRouteUtils } from '@api/utils/mcp-route-utils';
import { TenantRequestBinder } from '@api/server/tenant-request-binder';

/**
 * Api-key tenancy for the request pipeline. The token decides the site; `x-fc-site` only picks
 * among the sites an all-sites token already reaches. Every failure is a distinct, honest status: a
 * client that forgot its site gets a 400 that says so, not a 404 that sends it hunting for a hostname.
 */
export class ApiKeyTenantGate {
  private static readonly STATUS: Record<string, number> = { invalid_token: 401, site_required: 400, unknown_site: 404, site_mismatch: 403 };

  private readonly resolver: ApiKeyTenantResolver;

  constructor(db: any, tenants: TenantResolverService, private readonly binder: TenantRequestBinder, private readonly logger: Logger) {
    const lookup = new McpTokenLookupService(new McpTokenStore(db), () => new TenantRegistryService(db, tenants).list());
    this.resolver = new ApiKeyTenantResolver(lookup, tenants);
  }

  run(req: any, res: any, locale: string, next: any): void {
    this.resolver.resolve(req)
      .then(async ({ tenant, reason }) => {
        if (!tenant) {
          // The sites list is HOW an all-sites token learns what to name; it is the one token route
          // that runs without a site. Nothing tenant-scoped is reachable from it.
          if (reason === 'site_required' && McpRouteUtils.isSitesPath(String(req.path || ''))) {
            RequestContextUtils.storage.run({ locale }, () => next());
            return;
          }
          res.status(ApiKeyTenantGate.STATUS[reason ?? 'invalid_token']).json({ error: reason, siteHeader: McpWirePaths.SITE_HEADER });
          return;
        }
        if (!tenant.isActive) {
          res.status(503).json({ error: 'tenant_suspended' });
          return;
        }
        await this.binder.bind(req, res, locale, tenant, next, 'api-key');
      })
      .catch((error: unknown) => {
        this.logger.error('Api-key tenant resolution failed', error);
        res.status(500).json({ error: 'tenant_resolution_failed' });
      });
  }
}

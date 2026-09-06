import type { TenantRecord, TenantResolverService } from '@fromcode119/core';
import { RequestTenantService } from '@api/services/request/request-tenant-service';

/**
 * The WORKSPACE whose domain a request arrived on, or null (T6 §3.2).
 *
 * A workspace tenant's domain IS its console, so on that host the host names the tenant — the
 * session's claim does not get a say, and the switcher is gone. The same candidates as storefront
 * tenancy are tried, in the same trust order: the Host (the admin app's own server-side calls, the
 * gateway), then the browser's Origin/Referer (the console's XHR reaches the api on the shared api
 * host, carrying the workspace domain as its Origin). A site host or the platform's own admin host
 * resolves to nothing here and the request falls back to the session-token rule.
 */
export class WorkspaceHostService {
  constructor(private readonly tenants: TenantResolverService) {}

  async resolve(req: any): Promise<TenantRecord | null> {
    for (const host of RequestTenantService.hostCandidates(req)) {
      const tenant = await this.tenants.resolveByHost(host);
      if (tenant?.isWorkspace) return tenant;
    }
    return null;
  }

  /** What the resolver published on the request, for controllers that must answer differently on a workspace host. */
  static of(req: any): TenantRecord | null {
    const tenant = req?.workspaceTenant;
    return tenant && typeof tenant === 'object' && typeof tenant.id === 'string' ? (tenant as TenantRecord) : null;
  }
}

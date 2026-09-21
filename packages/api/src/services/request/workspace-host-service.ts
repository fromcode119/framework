import { TenantHostRole } from '@fromcode119/core';
import type { TenantRecord, TenantResolverService } from '@fromcode119/core';
import { RequestTenantService } from '@api/services/request/request-tenant-service';

/**
 * The tenant whose ADMIN host a request arrived on, or null.
 *
 * On such a host the host names the tenant — the session's claim does not get a say, and the
 * switcher is gone. The same candidates as storefront tenancy are tried, in the same trust order:
 * the Host (the admin app's own server-side calls, the gateway), then the browser's Origin/Referer
 * (the console's XHR reaches the api on the shared api host, carrying that domain as its Origin).
 *
 * WHICH HOSTS COUNT IS DECLARED, not inferred from the tenant's kind. This used to ask
 * `tenant.isWorkspace`, which was right while a console could only ever be a workspace's own domain.
 * Now a SITE can declare one of its hosts as its console, and that host has to pin the scope the
 * same way — otherwise it opens the admin and manages whatever the session happened to have
 * selected, which is a different site's data on a URL that names this one.
 *
 * A workspace's hosts still answer here with no configuration at all: `roleFor` falls back to the
 * tenant's kind, and a workspace's default IS admin. A storefront host, and the platform's own admin
 * host, resolve to nothing and the request falls back to the session-token rule.
 */
export class WorkspaceHostService {
  constructor(private readonly tenants: TenantResolverService) {}

  async resolve(req: any): Promise<TenantRecord | null> {
    for (const host of RequestTenantService.hostCandidates(req)) {
      const tenant = await this.tenants.resolveByHost(host);
      if (tenant && tenant.roleFor(host) === TenantHostRole.ADMIN) return tenant;
    }
    return null;
  }

  /** What the resolver published on the request, for controllers that must answer differently on a workspace host. */
  static of(req: any): TenantRecord | null {
    const tenant = req?.workspaceTenant;
    return tenant && typeof tenant === 'object' && typeof tenant.id === 'string' ? (tenant as TenantRecord) : null;
  }
}

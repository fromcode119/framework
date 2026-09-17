import { Logger, TenantMembershipService, TenantResolverService } from '@fromcode119/core';
import { AuthManager } from '@fromcode119/auth';
import { IDatabaseManager } from '@fromcode119/database';
import { AdminTenantResolver } from '@api/services/request/admin-tenant-resolver';
import { WorkspaceHostService } from '@api/services/request/workspace-host-service';
import { ApiKeyTenantGate } from '@api/server/api-key-tenant-gate';
import { SiteVisibilityGate } from '@api/server/site-visibility-gate';
import { SiteVisibilityMiddleware } from '@api/server/site-visibility-middleware';
import { TenantRequestBinder } from '@api/server/tenant-request-binder';

/**
 * The collaborators the tenant middlewares are built from.
 *
 * Every one of them is built LAZILY and shared: they need the manager's runtime database connection,
 * which does not exist when the middleware setup is constructed, and each holds a resolver cache that
 * only pays for itself if all three surfaces — storefront, api-key and admin — ask the same instance.
 *
 * Together rather than as five fields on the setup, because they form one graph: the api-key gate is
 * built from the resolver and the binder, and the admin resolver from the resolver and a membership
 * service over the same connection.
 */
export class ServerTenantMiddlewareParts {
  private tenants: TenantResolverService | null = null;
  private apiKey: ApiKeyTenantGate | null = null;
  private tenantBinder: TenantRequestBinder | null = null;
  private siteVisibility: SiteVisibilityMiddleware | null = null;
  private adminTenant: AdminTenantResolver | null = null;

  constructor(
    private readonly db: IDatabaseManager,
    private readonly auth: AuthManager,
    private readonly logger: Logger,
  ) {}

  /** Host -> tenant. Shared, because it caches. */
  resolver(): TenantResolverService {
    return (this.tenants ??= TenantResolverService.shared(this.db));
  }

  /** Puts the resolved tenant on the request and runs the rest of the stack inside its scope. */
  binder(): TenantRequestBinder {
    return (this.tenantBinder ??= new TenantRequestBinder(this.db, this.logger));
  }

  /** Api-key surface: token -> tenant. */
  apiKeyGate(): ApiKeyTenantGate {
    return (this.apiKey ??= new ApiKeyTenantGate(this.db, this.resolver(), this.binder(), this.logger));
  }

  /** Decides whether a request may read a site that is not published yet. */
  visibilityGate(): SiteVisibilityMiddleware {
    return (this.siteVisibility ??= new SiteVisibilityMiddleware(new SiteVisibilityGate(this.db), this.logger));
  }

  /** Admin surface: session token -> tenant, membership-checked. */
  admin(): AdminTenantResolver {
    return (this.adminTenant ??= new AdminTenantResolver(
      this.auth,
      this.resolver(),
      new TenantMembershipService(this.db),
      new WorkspaceHostService(this.resolver()),
    ));
  }
}

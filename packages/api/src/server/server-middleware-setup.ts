/** ServerMiddlewareSetup — configures Express middlewares. Extracted from APIServer (ARC-007). */

import express from 'express';
import { CookieConstants, Logger, PluginManager, RequestContextUtils, TenantMembershipService, TenantMode, TenantResolverService } from '@fromcode119/core';
import { AuthManager } from '@fromcode119/auth';
import { SiteVisibilityGate } from '@api/server/site-visibility-gate';
import { ApiConfig } from '@api/config/api-config';
import { RequestCookieService } from '@api/services/request/request-cookie-service';
import { RequestLocaleService } from '@api/services/request/request-locale-service';
import { ApiPathUtils, RouteConstants, SystemConstants } from '@fromcode119/core';
import { RequestTenantService } from '@api/services/request/request-tenant-service';
import { AdminTenantResolver } from '@api/services/request/admin-tenant-resolver';
import { WorkspaceHostService } from '@api/services/request/workspace-host-service';
import { ScimRouteUtils } from '@api/utils/scim-route-utils';
import { InternalRouteUtils } from '@api/utils/internal-route-utils';
import { ApiKeyTenantResolver } from '@api/services/request/api-key-tenant-resolver';
import { ApiKeyTenantGate } from '@api/server/api-key-tenant-gate';
import { TenantRequestBinder } from '@api/server/tenant-request-binder';
import { RequestSurfaceUtils } from '@fromcode119/core';
import { PublicSystemRouteUtils } from '@api/utils/public-system-route-utils';
import { JsonCompressionMiddleware } from '@api/middlewares/json-compression-middleware';

export class ServerMiddlewareSetup {
  private readonly requestCookies = new RequestCookieService();
  private readonly requestLocale = new RequestLocaleService();
  private readonly jsonCompression = new JsonCompressionMiddleware();
  /** Host -> tenant. Built lazily from the manager's runtime connection. */
  private tenants: TenantResolverService | null = null;
  /** Api-key surface: token -> tenant. Built lazily alongside `tenants`. */
  private apiKey: ApiKeyTenantGate | null = null;
  private tenantBinder: TenantRequestBinder | null = null;
  private siteVisibility?: SiteVisibilityGate;

  /** Admin surface: session token -> tenant, membership-checked. Built lazily alongside `tenants`. */
  private adminTenant: AdminTenantResolver | null = null;

  constructor(
    private readonly app: express.Application,
    private readonly auth: AuthManager,
    private readonly manager: PluginManager,
    private readonly getMaintenanceStatus: () => Promise<boolean>,
    private readonly logger: Logger,
    private readonly getDefaultLocale: () => string = () => '',
  ) {}

  setup() {
    // Gzip for anonymous public JSON GETs (e.g. /system/frontend) — BREACH-scoped:
    // requests carrying auth credentials are never compressed. See the middleware class.
    this.app.use(this.jsonCompression.middleware());

    // Dynamic pre-auth plugin middlewares
    this.app.use((req, res, next) => this.manager.middlewares.dispatch('pre_auth' as any, req, res, next));

    this.app.use((req: any, res, next) => {
      // Prefer the platform's configured `default_locale` system setting; the
      // service's own 'en' default is only the last resort when none is configured.
      const locale = this.requestLocale.resolveRequestLocale(req, this.getDefaultLocale() || 'en');
      req.locale = locale;
      this.runWithTenant(req, res, locale, next);
    });

    this.app.use(this.auth.middleware());

    // Dynamic post-auth plugin middlewares
    this.app.use((req, res, next) => this.manager.middlewares.dispatch('post_auth' as any, req, res, next));

    // Maintenance mode check
    this.app.use(async (req: any, res, next) => {
      if (req.method === 'OPTIONS') return next();
      const isMaintenance = await this.getMaintenanceStatus();
      if (!isMaintenance) return next();

      res.setHeader('X-Framework-Maintenance', 'on');
      res.setHeader('Access-Control-Expose-Headers', 'X-Framework-Maintenance');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

      const isAdmin = req.user && req.user.roles && req.user.roles.includes('admin');
      const isPublicSystemRoute = PublicSystemRouteUtils.isMaintenanceBypassPath(String(req.path || ''));

      if (isAdmin) { this.logger.debug(`Maintenance: ADMIN BYPASS for ${req.path} (${req.user?.email})`); return next(); }
      if (isPublicSystemRoute) return next();

      this.logger.warn(`Maintenance: BLOCKED request to ${req.path} from ${req.user?.email || 'Guest'}`);
      // CORS headers (including Allow-Origin / Allow-Credentials) are set by the
      // upstream `cors(corsOptions)` middleware, which validates the origin against
      // the configured allowlist. Reflecting `req.headers.origin` here with
      // credentials would bypass that allowlist and turn maintenance responses into
      // a credential-leak vector.
      res.status(503).json({ error: 'Service Unavailable', message: 'System is currently undergoing maintenance. Please try again later.' });
    });

    // Dynamic pre-routing plugin middlewares
    this.app.use((req, res, next) => this.manager.middlewares.dispatch('pre_routing' as any, req, res, next));

    this.app.use((req: any, res, next) => {
      const probeRoutes = ApiConfig.getInstance().probeRoutes;
      const hasToken =
        this.requestCookies.hasCookie(req, CookieConstants.AUTH_TOKEN) ||
        this.requestCookies.hasCookie(req, CookieConstants.CLIENT_AUTH_TOKEN) ||
        Boolean(req.headers.authorization);
      const isNoise =
        req.url.includes(probeRoutes.HEALTH) ||
        req.url.includes(probeRoutes.READY) ||
        req.url.includes(ApiConfig.getInstance().routes.system.HEALTH) ||
        req.url.includes(ApiConfig.getInstance().routes.system.STATUS);
      if (!isNoise) {
        const cookieNames = Object.keys(req.cookies || {});
        this.logger.debug(`${req.method} ${req.url} - User: ${req.user ? req.user.email : 'None'} - HasToken: ${hasToken} - CookieNames: ${cookieNames.join(',') || 'none'}`);
      }
      if (!req.user && hasToken && !isNoise) this.logger.warn(`Token present but user not authenticated for ${req.url}. Possibly expired or invalid format.`);
      next();
    });
  }

  /**
   * Resolves the request's tenant from its Host header, publishes it on the async request context,
   * and binds the database connection to it for the whole request.
   *
   * Fail-closed by construction: an unknown host is REFUSED. There is no default tenant and no
   * "first tenant" fallback — serving one customer's data on an unrecognised domain is the single
   * failure this entire layer exists to prevent.
   */
  private runWithTenant(req: any, res: any, locale: string, next: any): void {
    // Infrastructure probes are not tenant traffic: an orchestrator health-checking the container
    // has no host to route by, and these endpoints return no tenant data. They are exempted by
    // PATH ONLY, and the exemption is deliberately limited to liveness/readiness — every route that
    // can return a row stays behind tenant resolution.
    if (this.isProbeRoute(req) || this.isPublicAssetRoute(req)) {
      RequestContextUtils.storage.run({ locale }, () => next());
      return;
    }

    // The platform gateway's own calls (the host → app routing map) are internal, authenticated by
    // the shared secret, and read the tenant table itself — no tenant applies. Without the secret the
    // path is an ordinary request and gets the ordinary answer (404 unknown_host).
    if (InternalRouteUtils.isAuthorizedInternal(req)) {
      RequestContextUtils.storage.run({ locale }, () => next());
      return;
    }

    // Single-tenant deployment: no tenants configured, so there is nothing to route by and nothing
    // to isolate. Behaves exactly as it did before tenancy existed. Every EXISTING installation is
    // in this state, which is why this is a required path and not an optimisation.
    if (!TenantMode.isEnabled()) {
      RequestContextUtils.storage.run({ locale }, () => next());
      return;
    }

    // SCIM is the same shape as an api key: an external IdP with no browser Origin, no session and no
    // site in the URL — its BEARER TOKEN names the site, and `ScimRouter`'s guard resolves it and binds
    // the request. Resolving by Host here instead refused every call with `unknown_host` before the
    // guard ever ran. Nothing is granted by this exemption: an unmatched token is still a 401, and the
    // router binds the tenant before any route sees the request.
    if (ScimRouteUtils.isScimPath(req)) {
      RequestContextUtils.storage.run({ locale }, () => next());
      return;
    }

    // A machine client with an API key has no browser Origin and the shared api host: its TOKEN names
    // the site (see ApiKeyTenantResolver). Checked before the admin/storefront split — an api-key
    // request with an admin client header is still an api-key request.
    if (ApiKeyTenantResolver.hasKey(req)) {
      this.apiKeyGate().run(req, res, locale, next);
      return;
    }

    // The admin is one host serving many tenants, so its tenant comes from the signed session token,
    // not the Host header. The storefront is the opposite and keeps resolving by host.
    if (RequestSurfaceUtils.isAdminRequestContext(req)) {
      this.runAdminTenant(req, res, locale, next);
      return;
    }

    // The Host first; then the browser's own Origin / Referer host. See RequestTenantService for why.
    const candidates = RequestTenantService.hostCandidates(req);
    const host = candidates[0] ?? '';

    this.resolveFirst(candidates)
      .then(async (tenant) => {
        if (!tenant) {
          res.status(404).json({ error: 'unknown_host', host });
          return;
        }
        if (!tenant.isActive) {
          res.status(503).json({ error: 'tenant_suspended', host });
          return;
        }
        // A site that is not open yet answers only to the people building it. 503 rather than 404:
        // the site exists and will be there later, and a 404 with a body tells a crawler the address
        // is wrong. `no-store` because this answer changes the moment somebody publishes.
        if (!(await this.visibilityGate().allows(tenant, req))) {
          res.status(503)
            .set('Retry-After', '3600')
            .set('Cache-Control', 'no-store')
            .set('X-Robots-Tag', 'noindex, nofollow')
            .json({ error: 'site_private', host });
          return;
        }

        await this.binder().bind(req, res, locale, tenant, next, 'storefront');
      })
      .catch((error: unknown) => {
        this.logger.error(`Tenant resolution failed for host "${host}"`, error);
        res.status(500).json({ error: 'tenant_resolution_failed' });
      });
  }

  private resolveTenant(host: string) {
    return this.tenantResolver().resolveByHost(host);
  }

  /** The first candidate host that names a tenant, or null. Order is the trust order. */
  private async resolveFirst(candidates: string[]) {
    for (const candidate of candidates) {
      const tenant = await this.resolveTenant(candidate);
      if (tenant) return tenant;
    }
    return null;
  }

  /**
   * Theme and plugin ASSETS — `themes/<slug>/ui/*`, `themes/<slug>/public/*`, `plugins/<slug>/ui/*` —
   * are files the operator installed once for the whole platform, served from disk. They carry no
   * tenant data, and the browser fetches them with a plain `<script src>` / `<link>` that sends no
   * Origin, so tenancy could never resolve them: the storefront's client theme bundle 404'd as
   * `unknown_host` while the server-rendered page around it looked fine. Exempt by path, like the
   * probes, and for the same reason: nothing here can return a row.
   */
  private isPublicAssetRoute(req: any): boolean {
    return RequestSurfaceUtils.isExtensionAssetPath(req?.path);
  }


  /**
   * Liveness/readiness only — never a data route.
   *
   * MATCHED EXACTLY, not by suffix. `endsWith('/health')` also matched
   * `/api/v1/plugins/<slug>/health` — and `context.api.health(...)` is a first-class part of the
   * plugin API, so every plugin that declares a health probe had that route silently exempted from
   * tenancy. It then ran with NO tenant bound: the tenant gate refused it, and any data it touched
   * would have been outside every tenant's policy. Found while verifying T2, on the first plugin
   * route that happened to be called `/health`.
   */
  /**
   * One of the guardless auth routes (`RouteConstants.AUTH_PUBLIC_SEGMENTS`) — matched EXACTLY on the
   * versioned and unversioned auth path, never by suffix, for the reason `isProbeRoute` documents:
   * a suffix match once exempted every plugin's own `/health` from tenancy.
   */
  private isPublicAuthRoute(req: any): boolean {
    const path = String(req?.path || '').replace(/\/+$/, '');
    const paths = RouteConstants.AUTH_PUBLIC_SEGMENTS.flatMap((segment) => {
      const full = `${SystemConstants.API_PATH.AUTH.BASE}${segment}`;
      return [full, ApiPathUtils.versioned(full)];
    });
    return paths.includes(path);
  }

  private isProbeRoute(req: any): boolean {
    const path = String(req?.path || '').replace(/\/+$/, '');
    const probes = ApiConfig.getInstance().probeRoutes;
    const versioned = (probe: string) => [probe, ApiPathUtils.versioned(probe)];
    return [...versioned(probes.HEALTH), ...versioned(probes.READY)].includes(path);
  }


  /**
   * Admin-surface tenancy. A failure here is never a 404: the client has to tell "you have not
   * picked a tenant yet" (prompt for one) apart from "your access was revoked" (re-authenticate),
   * and neither is "this domain does not exist".
   */
  private runAdminTenant(req: any, res: any, locale: string, next: any): void {
    this.resolveAdminTenant(req)
      .then(async ({ tenant, reason }) => {
        if (!tenant) {
          // Unauthenticated admin traffic still has to reach the auth middleware and the login
          // route, so it continues WITHOUT a tenant rather than being refused here. Every
          // tenant-scoped query remains fail-closed on its own.
          if (reason?.allowsUnauthenticatedSurface) {
            RequestContextUtils.storage.run({ locale }, () => next());
            return;
          }
          // A tenancy verdict must never take away the routes that EXIST to fix a bad session. On a
          // workspace domain the host names the tenant and membership decides, so an account with a
          // valid session and no membership there was answered `tenant_access_revoked` for every
          // admin-client request — `/auth/login` included, leaving no way to sign in as someone who
          // does have access, and `/auth/host` too, so the console could not even name the workspace
          // that had refused it. These routes are guardless and read no tenant rows, so they continue
          // WITHOUT a tenant bound: every tenant-scoped query behind them stays fail-closed.
          if (reason?.isAccessRevoked
            && (this.isPublicAuthRoute(req) || PublicSystemRouteUtils.isTenancyOptionalPath(String(req.path || '')))) {
            RequestContextUtils.storage.run({ locale }, () => next());
            return;
          }
          res.status(403).json({ error: reason?.value });
          return;
        }
        if (!tenant.isActive) {
          res.status(503).json({ error: 'tenant_suspended' });
          return;
        }

        await this.binder().bind(req, res, locale, tenant, next, 'admin');
      })
      .catch((error: unknown) => {
        this.logger.error('Admin tenant resolution failed', error);
        res.status(500).json({ error: 'tenant_resolution_failed' });
      });
  }

  private apiKeyGate(): ApiKeyTenantGate {
    if (!this.apiKey) this.apiKey = new ApiKeyTenantGate(this.manager.db, this.tenantResolver(), this.binder(), this.logger);
    return this.apiKey;
  }

  private binder(): TenantRequestBinder {
    if (!this.tenantBinder) this.tenantBinder = new TenantRequestBinder(this.manager.db, this.logger);
    return this.tenantBinder;
  }

  /** Decides whether a request may read a site that is not published yet. Built once. */
  private visibilityGate(): SiteVisibilityGate {
    if (!this.siteVisibility) this.siteVisibility = new SiteVisibilityGate(this.manager.db);
    return this.siteVisibility;
  }

  private resolveAdminTenant(req: any) {
    if (!this.adminTenant) {
      this.adminTenant = new AdminTenantResolver(
        this.auth,
        this.tenantResolver(),
        new TenantMembershipService(this.manager.db),
        new WorkspaceHostService(this.tenantResolver()),
      );
    }
    return this.adminTenant.resolve(req);
  }

  private tenantResolver(): TenantResolverService {
    if (!this.tenants) this.tenants = TenantResolverService.shared(this.manager.db);
    return this.tenants;
  }

}

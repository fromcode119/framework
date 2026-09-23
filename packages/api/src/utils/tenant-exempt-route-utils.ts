import { ApiPathUtils, RequestSurfaceUtils, RouteConstants, SystemConstants } from '@fromcode119/core';
import { ApiConfig } from '@api/config/api-config';

/**
 * The routes that answer WITHOUT a tenant bound, and the reason each one has to.
 *
 * Every entry here is a hole in the platform's strictest rule — an unknown host is refused, there is
 * no default tenant — so they live together rather than scattered through the middleware, where the
 * list of what is exempt could only be reconstructed by reading it.
 *
 * NOTHING HERE CAN RETURN A TENANT'S ROW. That is the test each one has to pass, not "it seemed
 * safe": a liveness probe returns a status, an asset is a file on disk the operator installed once
 * for the whole platform, and an ACME challenge is a random token paired with a hash of our account
 * key. If a candidate route can return data belonging to a site, it does not belong in this class.
 *
 * MATCHED EXACTLY, NEVER BY SUFFIX — except where the protocol puts a variable in the path, and then
 * by anchored PREFIX. `endsWith('/health')` also matched `/api/v1/plugins/<slug>/health`, and
 * `context.api.health(...)` is a first-class part of the plugin API, so every plugin that declared a
 * health probe had that route silently exempted and then ran with no tenant bound. Found while
 * verifying T2, on the first plugin route that happened to be called `/health`.
 */
export class TenantExemptRouteUtils {
  /** Liveness/readiness only — never a data route. */
  static isProbeRoute(req: any): boolean {
    const path = TenantExemptRouteUtils.pathOf(req);
    const probes = ApiConfig.getInstance().probeRoutes;
    const versioned = (probe: string) => [probe, ApiPathUtils.versioned(probe)];
    return [...versioned(probes.HEALTH), ...versioned(probes.READY)].includes(path);
  }

  /**
   * Theme and plugin ASSETS — `themes/<slug>/ui/*`, `themes/<slug>/public/*`, `plugins/<slug>/ui/*`.
   *
   * Files the operator installed once for the whole platform, served from disk. They carry no tenant
   * data, and the browser fetches them with a plain `<script src>` / `<link>` that sends no Origin,
   * so tenancy could never resolve them: the storefront's client theme bundle 404'd as
   * `unknown_host` while the server-rendered page around it looked fine.
   */
  static isPublicAssetRoute(req: any): boolean {
    return RequestSurfaceUtils.isExtensionAssetPath(req?.path);
  }

  /**
   * A certificate authority proving a host belongs to this platform.
   *
   * EXEMPT ON PURPOSE, and it has to be: the question is asked about a hostname that frequently has
   * no tenant yet — a customer domain being set up, or a platform host being brought online — and
   * tenant resolution would answer `unknown_host` to the one request that would let it become known.
   * The route reads one row of a platform table keyed by a random token, and every value it can
   * return is public by protocol.
   *
   * Anchored PREFIX rather than an exact match, because the token is part of the path. The prefix is
   * fixed by the protocol rather than chosen here, so it cannot collide with a plugin's route.
   */
  static isAcmeChallengeRoute(req: any): boolean {
    return String(req?.path || '').startsWith(`${RouteConstants.SEGMENTS.ACME_CHALLENGE}/`);
  }

  /**
   * The PLATFORM's own `robots.txt` — what a crawler is told about the api host itself.
   *
   * Returns two lines of protocol text derived from one platform setting. No tenant row can reach
   * it, which is the test every entry in this class has to pass.
   *
   * EXACT, and that matters here more than anywhere: a site's own robots.txt is served by a plugin
   * under `api/v1/plugins/<slug>/...`, so a suffix match would exempt a TENANT's route and run it
   * with no tenant bound — the same mistake `/health` made. Only the bare root path is exempt.
   */
  static isPlatformRobotsRoute(req: any): boolean {
    return TenantExemptRouteUtils.pathOf(req) === RouteConstants.SEGMENTS.ROBOTS;
  }

  /**
   * One of the guardless auth routes (`RouteConstants.AUTH_PUBLIC_SEGMENTS`) — matched EXACTLY on
   * the versioned and unversioned auth path.
   *
   * Used only where admin tenancy has already REFUSED a session: a browser must still be able to
   * reach its own login, or an account without a membership on a workspace domain has no way to sign
   * in as somebody who does have access.
   */
  static isPublicAuthRoute(req: any): boolean {
    const path = TenantExemptRouteUtils.pathOf(req);
    const paths = RouteConstants.AUTH_PUBLIC_SEGMENTS.flatMap((segment) => {
      const full = `${SystemConstants.API_PATH.AUTH.BASE}${segment}`;
      return [full, ApiPathUtils.versioned(full)];
    });
    return paths.includes(path);
  }

  /** The request path with any trailing slash removed, so an exact match is not defeated by one. */
  static pathOf(req: any): string {
    return String(req?.path || '').replace(/\/+$/, '');
  }
}

import { ApiPathUtils, RouteConstants } from '@fromcode119/core';

/**
 * Is this request the SCIM surface?
 *
 * SCIM is provisioning traffic from an external identity provider: no session, no browser Origin, and
 * the shared api host — so the Host header cannot name a site and tenant resolution by host refuses it
 * outright. The site is named by the BEARER TOKEN instead (`ScimTokenService.resolveTenant`), which is
 * the same rule an api key follows, so the surface has to be recognised before the host split.
 *
 * Matched by PATH PREFIX only, and the path is the mount point — never a suffix match, which is how a
 * plugin route called `/health` once slipped past tenancy entirely.
 */
export class ScimRouteUtils {
  static isScimPath(req: unknown): boolean {
    const path = String((req as { path?: unknown } | null)?.path ?? '').trim();
    if (!path) return false;
    // Both the versioned mount (`/api/v1/scim/v2`) and the bare segment, since `req.path` differs by
    // where the check runs in the stack.
    for (const base of [ApiPathUtils.versioned(RouteConstants.SEGMENTS.SCIM_BASE), RouteConstants.SEGMENTS.SCIM_BASE]) {
      if (path === base || path.startsWith(`${base}/`)) return true;
    }
    return false;
  }
}

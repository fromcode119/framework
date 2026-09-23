import { AdminSiteHeaderConstants, ApiPathUtils, SystemConstants } from '@fromcode119/core';
import { TenantExemptRouteUtils } from '@api/utils/tenant-exempt-route-utils';

/**
 * Refuses an admin WRITE whose page was opened for a different site than the session is on now.
 *
 * The session's site is shared by every tab. A page opened for site A in one tab, saved after another
 * tab switched the session to site B, used to write A's form values into B — with a success toast.
 * The admin names the site each page was opened for (`X-Framework-Site`); a mismatch is answered
 * 409 `site_changed` and nothing is written. Reads are never refused, and a request that names no
 * site is left alone: the header only narrows what the session already allows.
 */
export class AdminSiteExpectationGuard {
  private static readonly SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

  /** The refusal body, or null when the write may proceed. `currentSiteId` is null in the platform scope. */
  static refusal(req: any, currentSiteId: string | null): Record<string, string> | null {
    if (AdminSiteExpectationGuard.SAFE_METHODS.has(String(req?.method || '').toUpperCase())) return null;
    const expected = String(req?.headers?.[AdminSiteHeaderConstants.NAME.toLowerCase()] ?? '').trim();
    if (!expected) return null;
    // Switching site is the one write that is SUPPOSED to change it; signing in and out carry no page.
    if (AdminSiteExpectationGuard.isSiteSwitch(req) || TenantExemptRouteUtils.isPublicAuthRoute(req)) return null;

    const current = currentSiteId || AdminSiteHeaderConstants.PLATFORM;
    if (expected === current) return null;
    return {
      error: 'site_changed',
      expected,
      current,
      message: 'Nothing was saved: this page was opened for another site than the one your session is on now '
        + '(the site was switched in another tab). Reload the page to see and edit the current site.',
    };
  }

  private static isSiteSwitch(req: any): boolean {
    const path = TenantExemptRouteUtils.pathOf(req);
    const select = SystemConstants.API_PATH.AUTH.TENANTS_SELECT;
    return path === select || path === ApiPathUtils.versioned(select);
  }
}

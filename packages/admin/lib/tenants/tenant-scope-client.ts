import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';

/**
 * Stepping out of a site, into the platform scope.
 *
 * Extracted from the header switcher because it is no longer only the header's business: Settings →
 * General hides the settings that do not belong to the current scope, so the screen itself has to be
 * able to offer the way across. Two copies of this POST would be two places to forget the reload.
 */
export class TenantScopeClient {
  /**
   * Leave the selected site. Resolves `true` when the session actually changed.
   *
   * The caller reloads rather than re-rendering: the site's data must not linger in a console that is
   * no longer on that site.
   */
  static async leave(): Promise<boolean> {
    return AdminApi.post(AdminConstants.ENDPOINTS.AUTH.TENANTS_LEAVE, {})
      .then(() => true)
      .catch(() => false);
  }

  /** Leave and reload, which is what every caller wants. */
  static async leaveAndReload(): Promise<void> {
    if (await TenantScopeClient.leave()) window.location.reload();
  }
}

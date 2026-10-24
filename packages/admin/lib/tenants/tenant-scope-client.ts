import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { SidebarSiteItems } from '@/app/components/view/sidebar-site-items';

/**
 * Stepping out of a site, into the platform scope.
 *
 * Extracted from the header switcher because it is no longer only the header's business: Settings →
 * General hides the settings that do not belong to the current scope, so the screen itself has to be
 * able to offer the way across. Two copies of this POST would be two places to forget the reload.
 */
export class TenantScopeClient {
  /**
   * Leave the selected site. Resolves `null` when the session actually changed, otherwise the
   * server's refusal in words an operator can act on.
   *
   * The refusal is returned, never swallowed: a console whose host is bound to one site refuses
   * every leave, and a button that silently does nothing is a dead control.
   */
  static async leave(): Promise<string | null> {
    return AdminApi.post(AdminConstants.ENDPOINTS.AUTH.TENANTS_LEAVE, {})
      .then(() => null)
      .catch((error: unknown) => SidebarSiteItems.reasonFor(error));
  }

  /**
   * Leave and reload, which is what every caller wants. The caller reloads rather than re-rendering:
   * the site's data must not linger in a console that is no longer on that site. Resolves the refusal
   * when there was one, so the caller can say why nothing happened.
   */
  static async leaveAndReload(): Promise<string | null> {
    const failure = await TenantScopeClient.leave();
    if (!failure) window.location.reload();
    return failure;
  }

  /**
   * Whether this console's HOST binds it to one site — a site's own console host or path. There is
   * no platform scope to step out to from such a console, so nothing should offer one.
   */
  static async hostLocksSite(): Promise<boolean> {
    const response = await AdminApi.get(AdminConstants.ENDPOINTS.AUTH.TENANTS_AVAILABLE).catch(() => null);
    return response?.locked === true;
  }
}

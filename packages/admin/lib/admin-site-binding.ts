import { AdminSiteHeaderConstants } from '@fromcode119/core/client';

/**
 * The site THIS TAB's page was opened for, named on every write it makes (`X-Framework-Site`).
 *
 * The session's site is shared by all tabs, so another tab switching site used to redirect this tab's
 * next save into the new site with this page's values. The first answer this page load receives about
 * its site is kept — a later read in the same tab after another tab switched would only name the new
 * site and hide the mismatch. A switch in THIS tab reloads the page, which starts a new binding.
 */
export class AdminSiteBinding {
  private static opened: string | null = null;

  /** Record the site the page opened on; `null` is the platform scope. Only the first call counts. */
  static record(siteId: string | null): void {
    if (AdminSiteBinding.opened !== null) return;
    AdminSiteBinding.opened = siteId || AdminSiteHeaderConstants.PLATFORM;
  }

  /** The header for a write, or none while the page has not learnt its site yet. */
  static headers(method: string | undefined): Record<string, string> {
    const safe = ['GET', 'HEAD', 'OPTIONS'].includes(String(method || 'GET').toUpperCase());
    if (safe || AdminSiteBinding.opened === null) return {};
    return { [AdminSiteHeaderConstants.NAME]: AdminSiteBinding.opened };
  }
}

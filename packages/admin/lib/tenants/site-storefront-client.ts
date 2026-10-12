import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';

/**
 * Where the site this console is bound to serves its pages.
 *
 * The API answers it from the site's own declared hosts (`storefrontUrl` on the tenant list). The
 * admin used to know no such thing: with a site's `site_url` empty — the norm on a multi-site
 * platform, where that setting is site-owned and deliberately left blank — every "Preview" link fell
 * through to guessing from the console's OWN hostname, and opened the page on the console, which
 * answered "Collection Not Found".
 *
 * One request per page load, shared by every caller. `''` in the platform scope, on a single-site
 * deployment, and when the lookup fails: the caller then keeps its previous resolution, so a failed
 * lookup is never worse than before this existed.
 */
export class SiteStorefrontClient {
  private static pending: Promise<{ storefrontUrl: string; siteId: string }> | null = null;

  static current(): Promise<string> {
    return SiteStorefrontClient.load().then((answer) => answer.storefrontUrl);
  }

  /**
   * The id of the site this console is bound to; '' in the platform scope and on a single-site
   * deployment. The Preview button needs it to ask for a preview link into that site.
   */
  static currentSiteId(): Promise<string> {
    return SiteStorefrontClient.load().then((answer) => answer.siteId);
  }

  /** Kept so tests can start from nothing. */
  static reset(): void {
    SiteStorefrontClient.pending = null;
  }

  private static load(): Promise<{ storefrontUrl: string; siteId: string }> {
    SiteStorefrontClient.pending ??= AdminApi.get(AdminConstants.ENDPOINTS.AUTH.TENANTS_AVAILABLE)
      .then((response: any) => ({
        storefrontUrl: String(response?.storefrontUrl ?? '').trim(),
        siteId: String(response?.current ?? '').trim(),
      }))
      .catch(() => ({ storefrontUrl: '', siteId: '' }));
    return SiteStorefrontClient.pending;
  }
}

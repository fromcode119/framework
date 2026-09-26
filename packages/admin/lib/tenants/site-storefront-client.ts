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
  private static pending: Promise<string> | null = null;

  static current(): Promise<string> {
    SiteStorefrontClient.pending ??= AdminApi.get(AdminConstants.ENDPOINTS.AUTH.TENANTS_AVAILABLE)
      .then((response: any) => String(response?.storefrontUrl ?? '').trim())
      .catch(() => '');
    return SiteStorefrontClient.pending;
  }

  /** Kept so tests can start from nothing. */
  static reset(): void {
    SiteStorefrontClient.pending = null;
  }
}

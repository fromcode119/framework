import { SitesClient } from '@/lib/tenants/sites-client';
import { SiteStorefrontClient } from '@/lib/tenants/site-storefront-client';

/**
 * Opens a site's storefront in a new tab — the published one directly, an unpublished one through a
 * one-time preview link.
 *
 * The two cases cannot be one link. The console's session cookie is host-scoped on purpose, so it is
 * never sent to the site's own domain and on a customer's apex domain never could be; navigating
 * straight to an unpublished site therefore lands on the holding page, which is exactly what
 * `TenantVisibility.PRIVATE` promises will not happen to the people building it.
 *
 * THE TAB IS OPENED BEFORE THE REQUEST and pointed afterwards. A `window.open` that happens after an
 * `await` is no longer attributable to the click and browsers block it as a popup — and it is opened
 * WITHOUT `noopener`, with the opener severed by hand instead, because `window.open` with that flag
 * returns null by specification and leaves nothing to point.
 */
export class SitePreviewLauncher {
  /** Opens `url` in a new tab, or in this one if the browser refused to give a handle. */
  static open(url: string): void {
    const tab = window.open('about:blank', '_blank');
    if (!tab) {
      window.location.assign(url);
      return;
    }
    tab.opener = null;
    tab.location.href = url;
  }

  /**
   * Mints a preview link for one site and opens it. Throws whatever the api refused with, so the
   * caller can say so; the blank tab is closed first, because an orphan tab on an error is litter.
   */
  static async openPreview(siteId: string): Promise<void> {
    const tab = window.open('about:blank', '_blank');
    if (tab) tab.opener = null;
    try {
      const url = await SitesClient.previewLink(siteId);
      if (tab) tab.location.href = url;
      else window.location.assign(url);
    } catch (error) {
      tab?.close();
      throw error;
    }
  }

  /**
   * Opens one record's page on its site, drafts included.
   *
   * A draft is visible only to the people building the site, and on the site's own host the console
   * session never arrives — so a plain link to `<site>/<path>?preview=1` answered "Page not found"
   * for every unpublished post. Inside a site this asks for a preview link that lands on that page;
   * outside one (platform scope, single-site deployment) the console and the site share a session
   * and the plain link is the right one.
   */
  static async openRecord(url: string): Promise<void> {
    const tab = window.open('about:blank', '_blank');
    if (tab) tab.opener = null;
    const go = (target: string) => (tab ? (tab.location.href = target) : window.location.assign(target));
    const siteId = await SiteStorefrontClient.currentSiteId();
    if (!siteId) {
      go(url);
      return;
    }
    try {
      const target = new URL(url, window.location.href);
      go(await SitesClient.previewLink(siteId, `${target.pathname}${target.search}`));
    } catch (error) {
      tab?.close();
      throw error;
    }
  }
}

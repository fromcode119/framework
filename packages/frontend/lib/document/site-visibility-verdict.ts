import { FrontendConfigCache } from '@/lib/frontend-config-cache';

/**
 * Whether THIS site may be indexed, read off the payload the storefront already fetches per render.
 *
 * The storefront has no tenant knowledge of its own — it forwards a host and the api resolves it —
 * so `/system/frontend` is the only place the answer can come from without a second round trip, and
 * `FrontendConfigCache` has already memoised it for this request.
 *
 * FAIL CLOSED. If the payload cannot be read, or names no site, the answer is "not indexable". A
 * storefront that becomes indexable because a lookup failed is indexable by omission — the same
 * pattern the admin was already fixed for, and the reason `/robots.txt` used to answer `Allow: /`
 * whenever the plugin that serves it was inactive.
 */
export class SiteVisibilityVerdict {
  /** True only when a site is resolved AND says it is indexable. */
  static async isIndexable(): Promise<boolean> {
    try {
      const config = await FrontendConfigCache.read();
      const site = (config as { site?: { isIndexable?: unknown } } | null)?.site;
      return site?.isIndexable === true;
    } catch {
      return false;
    }
  }

  /**
   * Indexable, OR this deployment has no sites at all.
   *
   * The two are one question for the renderer: a single-tenant storefront has no tenant row, and
   * treating "no site" as "not indexable" would take every existing single-site deployment out of
   * the index on upgrade. Absence of tenancy is not an unpublished site.
   */
  static async indexableOrUntenanted(): Promise<boolean> {
    if (!(await SiteVisibilityVerdict.isTenanted())) return true;
    return SiteVisibilityVerdict.isIndexable();
  }

  /**
   * A single-site deployment has no tenant row, so there is no site to ask about.
   *
   * It must not be treated as "not indexable" — that would take every existing single-tenant
   * storefront out of the index on upgrade. Absence of tenancy is not a private site.
   */
  static async isTenanted(): Promise<boolean> {
    try {
      const config = await FrontendConfigCache.read();
      return Boolean((config as { site?: unknown } | null)?.site);
    } catch {
      return false;
    }
  }
}

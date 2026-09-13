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
  /**
   * Whether THIS request may read this site at all.
   *
   * Asked BEFORE any content is fetched. The api refuses a private site's content with a 503, and
   * the storefront reads a 503 from the api as "unavailable, try another prefix" — which surfaced as
   * a 500 rather than the holding page. Deciding from the config the storefront already has avoids
   * inferring intent from an error.
   *
   * `preview` is the api's verdict on the preview cookie this render forwarded: a site's own people
   * may read it while it is closed. The answer is per request, which is why the payload it comes
   * from is `no-store` for a closed site — see SystemMetadataController.
   */
  static async isReadable(): Promise<boolean> {
    try {
      const config = await FrontendConfigCache.read();
      const site = (config as { site?: { isReadable?: unknown; preview?: unknown } } | null)?.site;
      if (!site) return true;
      return site.isReadable === true || site.preview === true;
    } catch {
      return true;
    }
  }

  /**
   * Whether this render is somebody previewing a site that is NOT published.
   *
   * The one thing that makes the banner honest: it is true only when the site is closed AND this
   * caller was let in anyway. A published site never sets it — the api leaves it false there rather
   * than caching a per-caller answer for everyone.
   */
  static async isPreview(): Promise<boolean> {
    try {
      const config = await FrontendConfigCache.read();
      const site = (config as { site?: { preview?: unknown } } | null)?.site;
      return site?.preview === true;
    } catch {
      return false;
    }
  }

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

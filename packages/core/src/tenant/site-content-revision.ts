import { RequestContextUtils } from '@core/context/request-context';

/**
 * A number that changes whenever something a site's pages are built from changes.
 *
 * The storefront keeps each rendered page for anonymous visitors and serves it again only while this
 * revision is the one it was rendered under. It is bumped per site on every write that can reach a
 * page — a plugin's own tables (an order, a booking, a product), a collection saved through the admin,
 * a setting — and for every site at once on a platform-level change or an explicit cache purge.
 *
 * Over-invalidating is the safe direction: an order bumps its site although no page shows it, and the
 * only cost is one fresh render. Under-invalidating would show a visitor stale content, so anything
 * unsure bumps.
 *
 * In memory, per api process. The EPOCH changes with every start, so a restart can never hand the
 * storefront a revision an earlier process already used for different content.
 */
export class SiteContentRevision {
  private static readonly epoch = Date.now().toString(36);

  private static platform = 0;

  private static readonly sites = new Map<string, number>();

  /** The revision a page for `tenantId` is rendered under. */
  static current(tenantId: string | null | undefined): string {
    const site = tenantId ? SiteContentRevision.sites.get(String(tenantId)) || 0 : 0;
    return `${SiteContentRevision.epoch}.${SiteContentRevision.platform}.${site}`;
  }

  /** One site changed. `null` means the platform: every site's pages are stale. */
  static bump(tenantId: string | null | undefined): void {
    const id = String(tenantId ?? '').trim();
    if (!id) {
      SiteContentRevision.platform += 1;
      return;
    }
    SiteContentRevision.sites.set(id, (SiteContentRevision.sites.get(id) || 0) + 1);
  }

  /** The site the current request or job is bound to changed; nothing when no site is bound. */
  static bumpCurrentSite(): void {
    const tenantId = RequestContextUtils.getTenantId();
    if (tenantId) SiteContentRevision.bump(tenantId);
  }
}

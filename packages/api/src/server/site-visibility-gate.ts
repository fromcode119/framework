import { PublicSystemRouteUtils } from '@api/utils/public-system-route-utils';
import { CookieConstants, SitePreviewGrantService, TenantMembershipService, TenantRecord } from '@fromcode119/core';
import type { Request } from 'express';

/**
 * Whether a request may read a site that is not open to the public.
 *
 * A PRIVATE site is one somebody is still building. It must be closed to visitors and open to the
 * people building it — so this answers per request rather than per site, and the people who can see
 * it are the site's own admins and the platform owner. Everyone else gets the holding page.
 *
 * Deliberately NOT the check the platform-wide maintenance gate uses. That one passes anybody
 * holding the global `admin` role, which on a multi-site platform is every customer's own
 * administrator — they would each see every other customer's unpublished site.
 *
 * Suspension is a different axis and outranks this: a suspended site is already refused before any
 * of this runs, for everyone including its admins.
 */
export class SiteVisibilityGate {
  constructor(private readonly db: unknown) {}

  /**
   * Routes that answer even on a private site.
   *
   * Without them the site cannot be built: the admin's own storefront preview needs the frontend
   * config and the theme's assets, and a visitor must be able to LOG IN before they can be
   * recognised as an admin at all. Health is how the platform watches itself.
   *
   * The preview exchange is here for the sharpest version of that reason. It is the request that
   * turns an operator into somebody this gate recognises, and it is made against the very site it is
   * for — so gating it would refuse the one call whose entire purpose is to lift the refusal. It
   * grants nothing on its own: the token in the path is checked against the table, against this
   * site, and it works once.
   */
  private static servesWhilePrivate(path: string): boolean {
    return PublicSystemRouteUtils.isAuthPath(path)
      || PublicSystemRouteUtils.isFrontendConfigPath(path)
      || PublicSystemRouteUtils.isHealthPath(path)
      || PublicSystemRouteUtils.isI18nPath(path)
      || PublicSystemRouteUtils.isUiAssetPath(path)
      || PublicSystemRouteUtils.isThemeAssetPath(path)
      || PublicSystemRouteUtils.isPluginAssetPath(path)
      || PublicSystemRouteUtils.isSitePreviewExchangePath(path);
  }

  /** Whether this request may read this site's content. */
  async allows(tenant: TenantRecord, req: Request): Promise<boolean> {
    if (tenant.visibility.isReadable) return true;
    if (SiteVisibilityGate.servesWhilePrivate(String(req.path || ''))) return true;
    return this.canPreview(tenant, req);
  }

  /**
   * Whether the caller is one of the people building this site.
   *
   * TWO WAYS TO BE RECOGNISED, because one of them cannot reach across hosts. The preview cookie is
   * the cross-domain one: the admin lives on its own host and sets its session cookie host-scoped on
   * purpose, so `fc_token` is never sent to a site's own domain and on a customer's apex domain it
   * never could be. The membership check is the same-host one, and it is what answers on a
   * single-tenant deployment where the console and the storefront share a domain.
   *
   * A request carrying neither is answered without touching the database — the overwhelmingly common
   * case for a private site is a stranger or a crawler, and it should cost nothing.
   */
  async canPreview(tenant: TenantRecord, req: Request): Promise<boolean> {
    if (await this.hasPreviewSession(tenant, req)) return true;

    const userId = String((req as Request & { user?: { id?: unknown } }).user?.id ?? '').trim();
    if (!userId) return false;

    const memberships = new TenantMembershipService(this.db as never);
    if (await memberships.isPlatformAdminAccount(userId)) return true;

    const roles = await memberships.rolesForTenant(userId, tenant.id);
    return Array.isArray(roles) && roles.includes('admin');
  }

  /**
   * Whether this browser holds a live preview session FOR THIS SITE.
   *
   * The site is passed to the store rather than compared here: a session is bound to one tenant, and
   * a check that lives at the call site is a check the next call site forgets.
   */
  private async hasPreviewSession(tenant: TenantRecord, req: Request): Promise<boolean> {
    const cookie = (req as Request & { cookies?: Record<string, unknown> }).cookies?.[CookieConstants.SITE_PREVIEW];
    if (!cookie) return false;
    const grant = await new SitePreviewGrantService(this.db).verifySession(cookie, tenant.id);
    return grant !== null;
  }
}

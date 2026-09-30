import { InspectorAccess } from '@fromcode119/auth';
import { WorkspaceHostService } from '@api/services/request/workspace-host-service';
import { WorkspaceAccessDeniedError } from '@api/services/request/workspace-access-denied-error';
import { Request, Response } from 'express';
import { NetworkAddressUtils, PlatformSettingsService, SystemConstants, TenantMembershipService, TenantMode } from '@fromcode119/core';
import { randomUUID } from 'crypto';
import { AuthControllerTenantSelection } from '@api/controllers/auth/auth-controller-tenant-selection';
import { LoginTenantChoice } from '@api/controllers/auth/login-tenant-choice';

/**
 * Issuing the session a successful login gets.
 *
 * The last link in the auth chain before the flows that use it. The policy it enforces arrives
 * from the links below — settings, throttle, account state, tenant selection — each split out when
 * this file reached 567 lines, following the chain this controller was already built as.
 */
export class AuthControllerPolicy extends AuthControllerTenantSelection {
  /** The surface the request binder records for a request that reached a site by its own host. */
  private static readonly STOREFRONT_SURFACE = 'storefront';

  /**
   * Makes an account that signs up on a site's STOREFRONT a customer of that site.
   *
   * `users` is global; what makes an account one of a site's customers is its membership, and a login
   * enters the storefront's site only for a member (LoginTenantChoice). Sign-up created the account and
   * nothing else, so a customer who registered on a storefront was issued a session tied to no site,
   * which the storefront refused on the next request. Same rule as a plugin creating a person
   * (`context.users.create`), made stricter: ANY existing membership row is left alone, whatever its
   * state — a site's administrator keeps their roles, and a customer the site suspended cannot
   * re-activate themselves by signing up again or signing in with a provider.
   */
  protected async joinStorefrontSite(req: Request, userId: string | number): Promise<void> {
    if (await this.belongsToStorefrontSite(req, userId)) return;
    await new TenantMembershipService(this.db).grant(String(userId), AuthControllerPolicy.storefrontSiteId(req), ['customer']);
  }

  /**
   * Whether the account already belongs to the storefront's site — any membership, in any state — or
   * there is no storefront site to join (the console, the platform host, a single-site deployment).
   * An account that does NOT belong would be JOINING the site, which is signing up: it is allowed only
   * where the site's registration is open.
   */
  protected async belongsToStorefrontSite(req: Request, userId: string | number): Promise<boolean> {
    const storefrontId = AuthControllerPolicy.storefrontSiteId(req);
    if (!TenantMode.isEnabled() || !storefrontId) return true;
    if (await new TenantMembershipService(this.db).hasAccess(String(userId), storefrontId)) return true;
    return Boolean(await this.db.findOne(SystemConstants.TABLE.TENANT_MEMBERSHIPS, { user_id: String(userId), tenant_id: storefrontId }));
  }

  private static storefrontSiteId(req: Request): string {
    return (req as any).tenantSurface === AuthControllerPolicy.STOREFRONT_SURFACE ? String((req as any).tenant?.id ?? '') : '';
  }

  protected async issueLoginSession(req: Request, res: Response, user: any) {
    // Bake EFFECTIVE roles (legacy column ∪ `_system_users_roles` junction) into the session token so
    // role assignments from the admin Roles UI / plugins actually drive guards and runtime behavior.
    const roles = await this.resolveEffectiveRoles(user);
    // Bake effective PERMISSIONS too so the admin client can decide console entry + permission-scoped
    // nav without an extra round-trip. Admins get ['*']; scoped operators get their set.
    const permissions = await this.auth.getUserPermissions(Number(user.id)).catch(() => [] as string[]);
    const jti = randomUUID();
    // Both flags ride on the user so the admin knows, before any page renders, whether this account
    // may act on the PLATFORM (install code, delete a plugin, switch the theme) or only on its site.
    // On a single-tenant deployment every admin is the platform, exactly as before tenancy existed.
    const multiTenant = TenantMode.isEnabled();
    const memberships = new TenantMembershipService(this.db);
    const platformAdmin = multiTenant ? await memberships.isPlatformAdminAccount(String(user.id)) : true;
    // Whether this account administers ANY site — what the admin's own door checks. Without it a site
    // administrator whose global role is `customer` is turned away before it can pick a site.
    const siteAdmin = multiTenant ? await memberships.administersAnyTenant(String(user.id)) : true;
    const userResponse = {
      id: String(user.id),
      email: this.normalizeEmail(user.email),
      firstName: this.readUserFirstName(user),
      lastName: this.readUserLastName(user),
      roles,
      permissions,
      jti,
      platformAdmin,
      siteAdmin,
      multiTenant,
    };
    const sessionDurationMinutes = await this.getSessionDurationMinutes();
    const maxAgeMs = sessionDurationMinutes * 60 * 1000;
    // Which tenants may this account enter, and which is it entering now?
    //
    // Login itself is TENANT-LESS: the account is global, so credentials are checked before any
    // tenant is known. Only afterwards does membership decide where they may go. Exactly one tenant
    // selects itself; several mean the client must ask, and the token carries no tenant until it
    // does. Single-tenant deployments skip all of this and behave exactly as before.
    const availableTenants = await this.resolveAvailableTenants(String(user.id));
    // On a WORKSPACE host the host names the tenant (T6): the session enters it, and an account
    // that is not a member of it is refused here rather than signed in with nowhere to go.
    const workspace = WorkspaceHostService.of(req);
    if (workspace && !availableTenants.some((tenant) => tenant.id === workspace.id)) {
      throw new WorkspaceAccessDeniedError(workspace.slug);
    }
    // On a site's STOREFRONT host that site is the one being logged into — see LoginTenantChoice.
    const storefrontId: string | null = (req as any).tenantSurface === AuthControllerPolicy.STOREFRONT_SURFACE
      ? ((req as any).tenant?.id ?? null)
      : null;
    const selectedTenantId = LoginTenantChoice.choose({
      workspaceId: workspace?.id,
      storefrontId,
      mayEnterStorefront: storefrontId ? await memberships.hasAccess(String(user.id), storefrontId) : false,
      administeredIds: availableTenants.map((tenant) => tenant.id),
    });

    // Entering a site at login is entering it scoped — same rule as switching site later.
    const scoped = await this.scopeSessionToTenant(String(user.id), selectedTenantId, { roles, permissions });
    userResponse.roles = scoped.roles;
    userResponse.permissions = scoped.permissions;
    const token = await this.auth.generateToken(userResponse, {
      expiresIn: `${sessionDurationMinutes}m`,
      tenantId: selectedTenantId,
    });
    const expiresAt = new Date(Date.now() + maxAgeMs);
    const sessionId = randomUUID();

    await this.db.insert(SystemConstants.TABLE.SESSIONS, {
      id: sessionId,
      userId: user.id,
      tenantId: selectedTenantId,
      tokenId: jti,
      expiresAt,
      userAgent: req.headers['user-agent'],
      ipAddress: NetworkAddressUtils.resolveClientIp(req)
    });

    const cookieOptions = this.getCookieOptions(req, false, maxAgeMs);
    const sessionCookieName = this.getSessionCookieName(req);

    // Each surface owns ONE cookie name (admin `fc_token`, storefront `userToken`) and the auth
    // middleware only ever reads the one belonging to the caller's surface — so the two sessions cannot
    // contaminate each other and there is nothing "conflicting" to clear. Logging in on the storefront
    // used to delete `fc_token`/`fc_user`, i.e. signing in as a customer silently ended the operator's
    // admin session in the other tab. A login issues its own cookie and touches no other surface.
    res.cookie(sessionCookieName, token, cookieOptions);

    // The token above carries the real roles; the admin is told what an inspector may SEE.
    return { token, user: InspectorAccess.presentToAdmin(userResponse), availableTenants };
  }
}

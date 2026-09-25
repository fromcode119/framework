import { AuthControllerLoginThrottle } from '@api/controllers/auth/auth-controller-login-throttle';
import { WorkspaceHostService } from '@api/services/request/workspace-host-service';
import { Request, Response } from 'express';
import { NetworkAddressUtils, PlatformSettingsService, SystemConstants, TenantMembershipService, TenantMode } from '@fromcode119/core';
import { ApiUrlUtils } from '@api/utils/url';

/**
 * Which sites this account may enter, and re-issuing its session scoped to the one it picks.
 *
 * A session is bound to ONE site. Choosing another is not a filter change — it mints a new session
 * for that tenant, which is what stops a token issued for one site being replayed against another.
 * Leaving returns to the platform scope the same way.
 */
export class AuthControllerTenantSelection extends AuthControllerLoginThrottle {
  /** How a platform admin opens a workspace from the shared host: as its appearance, or the default console. */
  static readonly WORKSPACE_MODES = ['appearance', 'configure'];

  /**
   * The tenants this account may enter. Empty on a single-tenant deployment, where tenancy is off
   * entirely and there is nothing to choose between.
   */
  protected async resolveAvailableTenants(userId: string): Promise<Array<{ id: string; slug: string; primaryHost: string; platformAccess: boolean; kind: string; appearance: string }>> {
    if (!TenantMode.isEnabled()) return [];
    const memberships = new TenantMembershipService(this.db);
    // The sites this account may ADMINISTER, not every site it belongs to: a customer membership
    // offers nothing to do in an admin console, and listing it there is a dead end.
    const access = await memberships.listAdministeredByUser(userId);
    // `platformAccess` travels with every entry so the admin can mark the tenants this account
    // reaches only through the platform role — i.e. someone else's customer data.
    return access.map((entry) => ({
      id: entry.tenant.id,
      slug: entry.tenant.slug,
      primaryHost: entry.tenant.primaryHost,
      platformAccess: entry.viaPlatformRole,
      kind: entry.tenant.kind.value,
      appearance: entry.tenant.appearance,
    }));
  }


  /**
   * Re-mints the session token for a DIFFERENT tenant and replaces the cookie.
   *
   * The tenant lives in a signed claim, so switching is a re-mint rather than a client-side flag —
   * nothing the browser can set decides which customer's data it sees. The caller has already
   * checked membership; this only issues.
   */
  /**
   * The roles and permissions a session carries INSIDE a site.
   *
   * A membership's roles are what the account may do THERE, so the session that enters a site must
   * say so: the admin decides what to render from the session, and a token still carrying the
   * account's global `customer` showed a site's administrator an admin with nothing in it. Falls back
   * to the global pair when the account has no membership to narrow by — a platform admin, or a
   * single-tenant deployment — which is exactly what `rolesForTenant` answers `null` for.
   */
  protected async scopeSessionToTenant(
    userId: string,
    tenantId: string | undefined,
    global: { roles: string[]; permissions: string[] },
  ): Promise<{ roles: string[]; permissions: string[] }> {
    if (!tenantId) return global;
    const roles = await new TenantMembershipService(this.db).rolesForTenant(userId, tenantId).catch(() => null);
    if (!roles) return global;
    return { roles, permissions: await this.auth.getPermissionsForRoles(roles) };
  }

  /**
   * Re-mint this session for a different scope. `tenantId` UNDEFINED means "no site" — the platform
   * scope — and is a real destination, not a missing argument: `scopeSessionToTenant` already returns
   * the account's unscoped roles for it, and `generateToken` simply omits the claim.
   */
  protected async reissueSessionForTenant(req: Request, res: Response, user: any, tenantId: string | undefined, workspaceMode?: string): Promise<string> {
    const sessionDurationMinutes = await this.getSessionDurationMinutes();
    const maxAgeMs = sessionDurationMinutes * 60 * 1000;
    // `req.user` is a DECODED token, so it already carries the claims jwt issued — `exp`, `iat`,
    // `nbf`. Re-signing with those still present makes jwt.sign reject `expiresIn` outright
    // ("the payload already has an exp property"), so they are dropped and re-issued fresh.
    //
    // `tenantId` is dropped for the same reason, and it is what makes LEAVING possible at all:
    // `generateToken` builds its payload by spreading this object and only ASSIGNS the claim when one
    // is supplied, so a `tenantId` carried over from the token being replaced would survive
    // `tenantId: undefined` untouched. Stepping out of a site would then re-mint the site you were
    // already in — which is exactly what it did until this line.
    const { exp, iat, nbf, workspaceMode: previousMode, tenantId: previousTenantId, ...identity } = user as Record<string, unknown>;
    void exp; void iat; void nbf; void previousMode; void previousTenantId;
    // Re-resolve from the ACCOUNT, never from the token being replaced: that token's roles are already
    // scoped to whichever site the session was in, and narrowing a narrowed set would let one site's
    // roles decide what the next site grants.
    const account = await this.db.findOne(SystemConstants.TABLE.USERS, { id: user.id }).catch(() => null);
    const scoped = await this.scopeSessionToTenant(String(user.id), tenantId, {
      roles: await this.resolveEffectiveRoles(account ?? user),
      permissions: await this.auth.getUserPermissions(Number(user.id)).catch(() => [] as string[]),
    });
    (identity as Record<string, unknown>).roles = scoped.roles;
    (identity as Record<string, unknown>).permissions = scoped.permissions;
    // How the PLATFORM admin opens a workspace from the shared host — as its appearance, or in the
    // default console to configure it. A per-session claim, never a tenant setting: the workspace's
    // own admins can never obtain it, because on their host the appearance is locked (T6 §3.3).
    if (workspaceMode) (identity as Record<string, unknown>).workspaceMode = workspaceMode;
    const token = await this.auth.generateToken(
      identity as any,
      { expiresIn: `${sessionDurationMinutes}m`, tenantId },
    );
    // CLEAR THE OTHER SCOPES FIRST, exactly as logout does and for the same reason. A session cookie
    // is only replaced by a `Set-Cookie` whose scope matches the one it was written with, and this
    // session is written HOST-scoped while older ones went to the apex. Setting alone left the wider
    // cookie in the browser, still sent on every request — and `AuthManager` builds its candidate
    // list from the RAW Cookie header, which preserves duplicates, then accepts whichever verifies
    // first. So the stale cookie kept deciding the tenant: leaving a site re-minted a claim-less
    // token that was never read, and switching sites had the same hole waiting behind it.
    //
    // Clearing runs BEFORE the set so the new host-scoped cookie is the last word for its own scope.
    const cookieName = this.getSessionCookieName(req);
    const cookieOptions = this.getCookieOptions(req, false, maxAgeMs);
    this.clearCookieVariants(res, cookieName, this.getCookieOptions(req, true), true, ApiUrlUtils.getCookieDomain(req));
    res.cookie(cookieName, token, cookieOptions);
    // The session ROW is the server's own record of which site this session is in, and it is what an
    // operator's support question is answered from. A swallowed failure here leaves the token saying
    // one thing and the row saying another, with nothing anywhere to say they disagreed — the same
    // shape as the client discarding the reason a switch was refused.
    //
    // It must not fail the switch: the token is already minted and the cookie already set, so the
    // session IS in the new site whatever this row says. Logged, not thrown.
    const updated = await this.db.update(
      SystemConstants.TABLE.SESSIONS,
      { tokenId: user.jti },
      { tenantId: tenantId ?? null },
    ).catch((error: unknown) => {
      this.logger.warn(`[auth] session row not updated for tenant "${tenantId ?? '(none)'}": ${String((error as Error)?.message ?? error)}`);
      return null;
    });
    // No row matched is NOT an error the database reports — it is a silent zero, and it means the
    // presented token's `jti` has no session row to carry the claim. Worth saying, because the token
    // still works and the disagreement only shows up later as a switch that appears not to happen.
    if (updated === undefined || updated === null) {
      this.logger.warn(`[auth] no session row for jti "${String(user.jti ?? '')}" — tenant "${tenantId ?? '(none)'}" recorded on the token only.`);
    }
    return token;
  }

  /** The tenants this account may enter. Empty on a single-tenant deployment. */
  async availableTenants(req: Request, res: Response) {
    const user = (req as any).user;
    if (!TenantMode.isEnabled()) return res.json({ multiTenant: false, tenants: [], current: null, locked: false, mode: null });
    const all = await this.resolveAvailableTenants(String(user.id));
    const workspace = WorkspaceHostService.of(req);
    // On a workspace host there is exactly one tenant and no switching (T6 §3.2).
    const tenants = workspace ? all.filter((tenant) => tenant.id === workspace.id) : all;
    return res.json({
      multiTenant: true,
      current: String((req as any).tenantId || '') || null,
      locked: workspace !== null,
      mode: String(user?.workspaceMode || '') || null,
      tenants,
    });
  }

  /**
   * PUBLIC: whose console is this host? The admin app asks before anyone is signed in, so a
   * workspace domain shows its own login (locked appearance, tenant name) rather than the platform's.
   * Nothing here that the domain itself does not already tell.
   */
  async hostInfo(req: Request, res: Response) {
    const workspace = WorkspaceHostService.of(req);
    return res.json({
      multiTenant: TenantMode.isEnabled(),
      workspace: workspace ? { id: workspace.id, slug: workspace.slug, appearance: workspace.appearance } : null,
      // Whether crawlers may index this console. Carried on the one response the admin already asks
      // for before anyone signs in, because the answer is needed to serve `robots.txt` and the
      // `X-Robots-Tag` on requests that have no session — a setting behind auth could not be read
      // by the very requests that need it. It reveals nothing the robots.txt would not.
      searchIndexing: await PlatformSettingsService.readFlag(
        SystemConstants.META_KEY.ADMIN_SEARCH_INDEXING,
      ),
    });
  }

  /**
   * What the browser SENT and what it is being TOLD, for one tenant switch.
   *
   * A switch that answers 200, writes the session row, and leaves the browser in the old scope has
   * exactly one unobservable step: the cookie exchange. `fc_token` is httpOnly and `Set-Cookie` is a
   * forbidden header, so neither side of it can be read from the page — which is how this class of
   * bug survives several rounds of confident, wrong diagnosis.
   *
   * NAMES AND ATTRIBUTES ONLY. A session token is a credential; it never appears here, and the count
   * of each name is what actually matters — two `fc_token` cookies arriving is the whole answer, and
   * their values would add nothing but risk to a log file.
   */
  private describeSessionCookieExchange(req: Request, res: Response, tenantId: string): void {
    const raw = String((req.headers as Record<string, unknown>)?.cookie ?? '');
    const presented = new Map<string, number>();
    for (const part of raw.split(';')) {
      const name = part.split('=')[0]?.trim();
      if (name) presented.set(name, (presented.get(name) ?? 0) + 1);
    }
    const sent = res.getHeader('Set-Cookie');
    const directives = (Array.isArray(sent) ? sent : [sent])
      .filter(Boolean)
      .map((entry) => {
        const [pair, ...attrs] = String(entry).split(';');
        const name = pair.split('=')[0]?.trim() ?? '?';
        const cleared = /expires=Thu, 01 Jan 1970|Max-Age=0/i.test(String(entry));
        return `${name}[${cleared ? 'CLEAR' : 'SET'}${attrs.map((a) => a.trim()).filter((a) => /^(domain|path|samesite|secure|httponly)/i.test(a)).map((a) => ` ${a}`).join('')}]`;
      });
    this.logger.info(
      `[auth] tenant switch to "${tenantId}" — presented: ${[...presented].map(([n, c]) => (c > 1 ? `${n} x${c}` : n)).join(', ') || '(none)'}`
      + ` | responding: ${directives.join(' ') || '(no Set-Cookie)'}`,
    );
  }

  /**
   * Switch tenant. A tenant the account may not enter is a 403 — never a redirect into one it can,
   * which would quietly put an operator in the wrong customer's site.
   */
  async selectTenant(req: Request, res: Response) {
    const user = (req as any).user;
    if (!TenantMode.isEnabled()) return res.status(400).json({ error: 'not_multi_tenant' });

    if (WorkspaceHostService.of(req)) return res.status(403).json({ error: 'workspace_host_locks_tenant' });

    const tenantId = String((req.body as any)?.tenantId || '').trim();
    if (!tenantId) return res.status(400).json({ error: 'tenantId_required' });
    const mode = String((req.body as any)?.mode || '').trim();
    if (mode && !AuthControllerTenantSelection.WORKSPACE_MODES.includes(mode)) return res.status(400).json({ error: 'mode_invalid', modes: AuthControllerTenantSelection.WORKSPACE_MODES });

    const memberships = new TenantMembershipService(this.db);
    if (!(await memberships.hasAccess(String(user.id), tenantId))) {
      return res.status(403).json({ error: 'tenant_access_denied' });
    }

    await this.reissueSessionForTenant(req, res, user, tenantId, mode || undefined);
    this.describeSessionCookieExchange(req, res, tenantId);
    return res.json({ ok: true, tenantId, mode: mode || null });
  }

  /**
   * Step OUT of every site, into the platform scope — the console with no tenant bound, where the
   * things that belong to the installation rather than to any one site are managed.
   *
   * The way back. Selecting a site was one-way: `selectTenant` refuses an empty id and the re-issue
   * could not mint a claim-less token, so an operator who picked a site stayed in one until they
   * logged in again. The scope existed on the api side all along — a session with no tenant claim is
   * already carried through unbound — with no route to reach it.
   *
   * PLATFORM ADMINS ONLY, enforced by the guard on the route. A site's own administrator has no
   * platform scope to step into, and handing them one would be the trust boundary the whole tenancy
   * programme exists to draw.
   */
  async leaveTenant(req: Request, res: Response) {
    const user = (req as any).user;
    if (!TenantMode.isEnabled()) return res.status(400).json({ error: 'not_multi_tenant' });
    // A workspace domain IS its tenant — there is no platform scope to stand in on that host, the
    // same reason selecting a different site is refused there.
    if (WorkspaceHostService.of(req)) return res.status(403).json({ error: 'workspace_host_locks_tenant' });

    // Checked HERE rather than as a route guard, matching `selectTenant` beside it: both answer
    // "may this account go there", and one place per question beats a guard that can be forgotten
    // on the next route added to this router.
    if (!(await new TenantMembershipService(this.db).isPlatformAdminAccount(String(user.id)))) {
      return res.status(403).json({ error: 'platform_admin_required' });
    }

    await this.reissueSessionForTenant(req, res, user, undefined);
    return res.json({ ok: true, tenantId: null });
  }
}

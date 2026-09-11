import { WorkspaceHostService } from '@api/services/request/workspace-host-service';
import { WorkspaceAccessDeniedError } from '@api/services/request/workspace-access-denied-error';
import { Request, Response } from 'express';
import { PlatformSettingsService, SystemConstants, TenantMembershipService, TenantMode } from '@fromcode119/core';
import { randomUUID } from 'crypto';
import { AuthControllerInfrastructure } from '@api/controllers/auth/auth-controller-infrastructure/auth-controller-infrastructure';
import { AccountStatus } from '@api/controllers/auth/enums/account-status.enum';
import type { IPasswordPolicySettings } from '@api/controllers/auth/interfaces/password-policy-settings.interface';
import type { ILoginThrottleSettings } from '@api/controllers/auth/interfaces/login-throttle-settings.interface';
import type { ILoginThrottleState } from '@api/controllers/auth/interfaces/login-throttle-state.interface';

export class AuthControllerPolicy extends AuthControllerInfrastructure {
  /** How a platform admin opens a workspace from the shared host: as its appearance, or the default console. */
  static readonly WORKSPACE_MODES = ['appearance', 'configure'];

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
    const selectedTenantId = workspace ? workspace.id : (availableTenants.length === 1 ? availableTenants[0].id : undefined);

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
      ipAddress: req.ip
    });

    const cookieOptions = this.getCookieOptions(req, false, maxAgeMs);
    const sessionCookieName = this.getSessionCookieName(req);

    // Each surface owns ONE cookie name (admin `fc_token`, storefront `userToken`) and the auth
    // middleware only ever reads the one belonging to the caller's surface — so the two sessions cannot
    // contaminate each other and there is nothing "conflicting" to clear. Logging in on the storefront
    // used to delete `fc_token`/`fc_user`, i.e. signing in as a customer silently ended the operator's
    // admin session in the other tab. A login issues its own cookie and touches no other surface.
    res.cookie(sessionCookieName, token, cookieOptions);

    return { token, user: userResponse, availableTenants };
  }

  protected async getSessionDurationMinutes(): Promise<number> {
    try {
      const row = await this.readMetaRow(SystemConstants.META_KEY.AUTH_SESSION_DURATION);
      const parsed = Number.parseInt(String(row?.value || this.defaultSessionDurationMinutes), 10);
      if (Number.isNaN(parsed)) return this.defaultSessionDurationMinutes;
      return Math.min(this.maxSessionDurationMinutes, Math.max(this.minSessionDurationMinutes, parsed));
    } catch {
      return this.defaultSessionDurationMinutes;
    }
  }

  protected async getSettingNumber(key: string, defaultValue: number, min: number, max: number): Promise<number> {
    const value = Number.parseInt(String((await this.getMetaValue(key)) || defaultValue), 10);
    if (Number.isNaN(value)) return defaultValue;
    return Math.min(max, Math.max(min, value));
  }

  protected async getSettingBoolean(key: string, defaultValue: boolean): Promise<boolean> {
    const value = await this.getMetaValue(key);
    if (value === null) return defaultValue;
    return String(value).trim().toLowerCase() === 'true';
  }

  protected async getPasswordPolicySettings(): Promise<IPasswordPolicySettings> {
    return {
      minLength: await this.getSettingNumber(SystemConstants.META_KEY.AUTH_PASSWORD_MIN_LENGTH, 8, 8, 128),
      requireUppercase: await this.getSettingBoolean(SystemConstants.META_KEY.AUTH_PASSWORD_REQUIRE_UPPERCASE, true),
      requireLowercase: await this.getSettingBoolean(SystemConstants.META_KEY.AUTH_PASSWORD_REQUIRE_LOWERCASE, true),
      requireNumber: await this.getSettingBoolean(SystemConstants.META_KEY.AUTH_PASSWORD_REQUIRE_NUMBER, true),
      requireSymbol: await this.getSettingBoolean(SystemConstants.META_KEY.AUTH_PASSWORD_REQUIRE_SYMBOL, false),
      historyCount: await this.getSettingNumber(SystemConstants.META_KEY.AUTH_PASSWORD_HISTORY, 5, 0, 20),
      breachCheck: await this.getSettingBoolean(SystemConstants.META_KEY.AUTH_PASSWORD_BREACH_CHECK, false)
    };
  }

  protected async validatePasswordAgainstPolicy(
    password: string,
    options: { userId?: number; email?: string; currentPasswordHash?: string } = {}
  ): Promise<string | null> {
    const value = String(password || '');
    const policy = await this.getPasswordPolicySettings();

    if (value.length < policy.minLength) {
      return `Password must be at least ${policy.minLength} characters.`;
    }
    if (policy.requireUppercase && !/[A-Z]/.test(value)) {
      return 'Password must include at least one uppercase letter.';
    }
    if (policy.requireLowercase && !/[a-z]/.test(value)) {
      return 'Password must include at least one lowercase letter.';
    }
    if (policy.requireNumber && !/[0-9]/.test(value)) {
      return 'Password must include at least one number.';
    }
    if (policy.requireSymbol && !/[^A-Za-z0-9]/.test(value)) {
      return 'Password must include at least one symbol.';
    }

    const normalizedEmail = this.normalizeEmail(options.email || '');
    if (normalizedEmail && value.toLowerCase().includes(normalizedEmail.split('@')[0])) {
      return 'Password must not include your email username.';
    }

    if (options.currentPasswordHash) {
      const matchesCurrent = await this.auth.comparePassword(value, options.currentPasswordHash);
      if (matchesCurrent) return 'New password must be different from your current password.';
    }

    if (options.userId && policy.historyCount > 0) {
      const history = await this.readPasswordHistory(options.userId);
      const recent = history.slice(0, policy.historyCount);
      for (const hash of recent) {
        const matches = await this.auth.comparePassword(value, hash);
        if (matches) return `Password must not match your last ${policy.historyCount} password(s).`;
      }
    }

    if (policy.breachCheck) {
      try {
        const breachResult: any = await this.manager.hooks.call('auth:password:breach-check', {
          password: value,
          email: normalizedEmail || undefined
        });
        if (breachResult?.compromised === true) {
          return 'This password appears in known data breaches. Choose a different password.';
        }
      } catch {
        // Ignore optional breach check provider failures.
      }
    }

    return null;
  }

  protected async getLoginThrottleSettings(): Promise<ILoginThrottleSettings> {
    return {
      threshold: await this.getSettingNumber(SystemConstants.META_KEY.AUTH_LOCKOUT_THRESHOLD, 5, 1, 50),
      windowMinutes: await this.getSettingNumber(SystemConstants.META_KEY.AUTH_LOCKOUT_WINDOW_MINUTES, 15, 1, 1440),
      lockoutMinutes: await this.getSettingNumber(SystemConstants.META_KEY.AUTH_LOCKOUT_DURATION_MINUTES, 30, 1, 43200),
      captchaEnabled: await this.getSettingBoolean(SystemConstants.META_KEY.AUTH_CAPTCHA_ENABLED, false),
      captchaThreshold: await this.getSettingNumber(SystemConstants.META_KEY.AUTH_CAPTCHA_THRESHOLD, 3, 1, 50)
    };
  }

  protected getLoginThrottleKey(email: string, ip: string): string {
    const normalizedEmail = this.normalizeEmail(email);
    const normalizedIp = String(ip || '').trim() || 'unknown';
    return `auth:login_throttle:${this.normalizeEmail(`${normalizedEmail}|${normalizedIp}`)}`;
  }

  protected async readLoginThrottleState(key: string): Promise<ILoginThrottleState> {
    const row = await this.readMetaRow(key);
    if (!row?.value) return { count: 0 };
    try {
      const parsed = JSON.parse(String(row.value));
      return {
        count: Number(parsed?.count || 0),
        firstFailureAt: parsed?.firstFailureAt ? String(parsed.firstFailureAt) : undefined,
        lastFailureAt: parsed?.lastFailureAt ? String(parsed.lastFailureAt) : undefined,
        lockedUntil: parsed?.lockedUntil ? String(parsed.lockedUntil) : undefined
      };
    } catch {
      return { count: 0 };
    }
  }

  protected isLoginLocked(state: ILoginThrottleState): boolean {
    if (!state?.lockedUntil) return false;
    const lockUntil = new Date(state.lockedUntil).getTime();
    if (Number.isNaN(lockUntil)) return false;
    return lockUntil > Date.now();
  }

  protected requiresCaptcha(state: ILoginThrottleState, settings: ILoginThrottleSettings): boolean {
    if (!settings.captchaEnabled) return false;
    return Number(state?.count || 0) >= settings.captchaThreshold;
  }

  protected async recordLoginFailure(key: string, settings: ILoginThrottleSettings) {
    const state = await this.readLoginThrottleState(key);
    const now = Date.now();
    const windowMs = settings.windowMinutes * 60 * 1000;

    let countFailures = 1;
    if (state.lastFailureAt) {
      const lastAt = new Date(state.lastFailureAt).getTime();
      if (!Number.isNaN(lastAt) && now - lastAt <= windowMs) {
        countFailures = Number(state.count || 0) + 1;
      }
    }

    const firstFailureAt = countFailures === 1 ? new Date(now).toISOString() : (state.firstFailureAt || new Date(now).toISOString());
    const lastFailureAt = new Date(now).toISOString();
    const payload: ILoginThrottleState = { count: countFailures, firstFailureAt, lastFailureAt };

    if (countFailures >= settings.threshold) {
      payload.lockedUntil = new Date(now + settings.lockoutMinutes * 60 * 1000).toISOString();
    }

    await this.upsertMeta(key, JSON.stringify(payload));
  }

  protected async clearLoginThrottleState(key: string) {
    await this.deleteMeta(key);
  }

  protected getPasswordHistoryKey(userId: number) {
    return `user:${userId}:password_history`;
  }

  protected getPasswordChangedAtKey(userId: number) {
    return `user:${userId}:password_changed_at`;
  }

  protected async readPasswordHistory(userId: number): Promise<string[]> {
    const row = await this.readMetaRow(this.getPasswordHistoryKey(userId));
    if (!row?.value) return [];
    try {
      const parsed = JSON.parse(String(row.value));
      if (!Array.isArray(parsed)) return [];
      return parsed.map((entry: any) => String(entry || '')).filter(Boolean);
    } catch {
      return [];
    }
  }

  protected async pushPasswordHistory(userId: number, hash: string) {
    const history = await this.readPasswordHistory(userId);
    const next = [String(hash), ...history.filter((entry) => String(entry) !== String(hash))];
    await this.upsertMeta(this.getPasswordHistoryKey(userId), JSON.stringify(next.slice(0, 25)));
  }

  protected getUserAccountStatusKey(userId: number) {
    return `user:${userId}:account_status`;
  }

  protected getForcePasswordResetKey(userId: number) {
    return `user:${userId}:force_password_reset`;
  }

  protected async setUserAccountStatus(userId: number, status: AccountStatus) {
    await this.upsertMeta(this.getUserAccountStatusKey(userId), status.value);
  }

  protected async getUserAccountStatus(userId: number): Promise<AccountStatus> {
    const row = await this.readMetaRow(this.getUserAccountStatusKey(userId));
    const value = String(row?.value || '').trim().toLowerCase();
    return AccountStatus.resolve(value);
  }

  protected async setForcePasswordReset(userId: number, enabled: boolean) {
    await this.upsertMeta(this.getForcePasswordResetKey(userId), enabled ? 'true' : 'false');
  }

  protected async getForcePasswordReset(userId: number): Promise<boolean> {
    const row = await this.readMetaRow(this.getForcePasswordResetKey(userId));
    return String(row?.value || '').trim().toLowerCase() === 'true';
  }

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

  protected async reissueSessionForTenant(req: Request, res: Response, user: any, tenantId: string, workspaceMode?: string): Promise<string> {
    const sessionDurationMinutes = await this.getSessionDurationMinutes();
    const maxAgeMs = sessionDurationMinutes * 60 * 1000;
    // `req.user` is a DECODED token, so it already carries the claims jwt issued — `exp`, `iat`,
    // `nbf`. Re-signing with those still present makes jwt.sign reject `expiresIn` outright
    // ("the payload already has an exp property"), so they are dropped and re-issued fresh.
    const { exp, iat, nbf, workspaceMode: previousMode, ...identity } = user as Record<string, unknown>;
    void exp; void iat; void nbf; void previousMode;
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
    res.cookie(this.getSessionCookieName(req), token, this.getCookieOptions(req, false, maxAgeMs));
    await this.db.update(
      SystemConstants.TABLE.SESSIONS,
      { tokenId: user.jti },
      { tenantId },
    ).catch(() => undefined);
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
        PlatformSettingsService.KEY.ADMIN_SEARCH_INDEXING,
      ),
    });
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
    if (mode && !AuthControllerPolicy.WORKSPACE_MODES.includes(mode)) return res.status(400).json({ error: 'mode_invalid', modes: AuthControllerPolicy.WORKSPACE_MODES });

    const memberships = new TenantMembershipService(this.db);
    if (!(await memberships.hasAccess(String(user.id), tenantId))) {
      return res.status(403).json({ error: 'tenant_access_denied' });
    }

    await this.reissueSessionForTenant(req, res, user, tenantId, mode || undefined);
    return res.json({ ok: true, tenantId, mode: mode || null });
  }

}

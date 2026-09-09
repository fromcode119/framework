import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import type { SignOptions } from 'jsonwebtoken';
import { CookieConstants, Logger, RequestSurfaceUtils, RouteConstants } from '@fromcode119/core';
import { UserPermissionChecker } from '@auth/permission-checker';
import type { IUser } from '@auth/interfaces/user.interface';
import type { ISessionValidator } from '@auth/interfaces/session-validator.interface';
import type { IApiKeyValidator } from '@auth/interfaces/api-key-validator.interface';

import { AuthTokenService } from '@auth/auth-token-service';

export class AuthManager {
  private secret: string;
  private tenantRoleResolver?: (userId: string, tenantId: string) => Promise<string[] | null>;
  private sessionValidator?: ISessionValidator;
  private apiKeyValidator?: IApiKeyValidator;
  private permissionChecker?: UserPermissionChecker;
  private logger = new Logger({ namespace: 'auth-manager' });
  private readonly tokens: AuthTokenService;

  constructor(secret: string = process.env.JWT_SECRET || '') {
    if (!secret) {
      throw new Error('AuthManager: JWT_SECRET must be set in environment variables. No default is allowed for security.');
    }
    this.secret = secret;
    this.tokens = new AuthTokenService(this.secret, () => this.sessionValidator);
  }

  /**
   * How to find what an account may do on the site a request is bound to.
   *
   * Injected rather than looked up here: this class holds a signing secret and nothing else, and the
   * membership tables belong to core. Left unset — every single-tenant deployment — roles stay exactly
   * what the account carries globally, which is the behaviour that existed before tenancy.
   */
  useTenantRoles(resolver: (userId: string, tenantId: string) => Promise<string[] | null>): void {
    this.tenantRoleResolver = resolver;
  }

  /**
   * The roles a request actually gets: the membership's, when there is one.
   *
   * Site membership carried roles that NOTHING read — every guard saw the account's global roles — so
   * an account that was a customer on one site and an administrator on another was one or the other
   * everywhere. A platform admin and a non-member both come back `null` and keep their global roles;
   * only a real membership narrows them.
   */
  private async applyTenantRoles(user: any, tenantId: string): Promise<any> {
    if (!this.tenantRoleResolver || !tenantId) return user;
    try {
      const roles = await this.tenantRoleResolver(String(user?.id ?? ''), tenantId);
      return roles ? { ...user, roles } : user;
    } catch (error: any) {
      // Fail CLOSED on the narrowing, not on the request: keeping global roles here would hand a site
      // the very privileges this is meant to scope away.
      this.logger.warn(`Could not resolve site roles for user ${user?.id}: ${error?.message || error}`);
      return { ...user, roles: [] };
    }
  }

  setSessionValidator(validator: ISessionValidator) {
    this.sessionValidator = validator;
  }

  setApiKeyValidator(validator: IApiKeyValidator) {
    this.apiKeyValidator = validator;
  }

  setPermissionChecker(checker: UserPermissionChecker) {
    this.permissionChecker = checker;
  }

  /**
   * Resolve a user's effective permissions (from their roles). Used to bake permissions into the login
   * session so the admin client can decide console entry + permission-scoped nav. Returns [] if no
   * checker is configured or on error.
   */
  async getUserPermissions(userId: number): Promise<string[]> {
    if (!this.permissionChecker) return [];
    try {
      return await this.permissionChecker.getUserPermissions(userId);
    } catch {
      return [];
    }
  }

  /**
   * The permissions a given set of ROLES carries — for baking a session that is scoped to one site,
   * where the roles come from the membership rather than the account.
   */
  async getPermissionsForRoles(roles: string[]): Promise<string[]> {
    if (!this.permissionChecker) return [];
    try {
      return await this.permissionChecker.permissionsForRoles(roles);
    } catch {
      return [];
    }
  }

  /** @inheritdoc — delegated to AuthTokenService. */
  async hashPassword(password: string): Promise<string> {
    return this.tokens.hashPassword(password);
  }

  /** @inheritdoc — delegated to AuthTokenService. */
  async comparePassword(password: string, hash: string): Promise<boolean> {
    return this.tokens.comparePassword(password, hash);
  }

  /** @inheritdoc — delegated to AuthTokenService. */
  async generateToken(...args: Parameters<AuthTokenService['generateToken']>): Promise<string> {
    return this.tokens.generateToken(...args);
  }

  /** @inheritdoc — delegated to AuthTokenService. */
  async generateRefreshToken(user: IUser): Promise<string> {
    return this.tokens.generateRefreshToken(user);
  }

  /** @inheritdoc — delegated to AuthTokenService. */
  async verifyToken(token: string, expected: { tenantId?: string } = {}): Promise<IUser> {
    return this.tokens.verifyToken(token, expected);
  }

  /** @inheritdoc — delegated to AuthTokenService. */
  async verifyRefreshToken(token: string): Promise<{ id: string, jti: string }> {
    return this.tokens.verifyRefreshToken(token);
  }

  middleware() {
    return async (req: any, res: any, next: any) => {
      const tokenCandidates: string[] = [];
      const sessionCookieNames = this.getSessionCookieNames(req);

      // API keys are accepted via the x-api-key header ONLY. Query-string keys
      // leak into access logs, proxies, browser history and Referer headers.
      const apiKey = req.headers?.['x-api-key'];
      if (apiKey && this.apiKeyValidator) {
        try {
          const user = await this.apiKeyValidator(String(apiKey), req);
          if (user) {
            req.user = { ...user, isApiKey: true };
            return next();
          }
        } catch (e) {
          this.logger.error(`API Key validation failed: ${e}`);
        }
      }

      // In admin-ui context, skip Bearer tokens. Admin requests authenticate exclusively via the
      // fc_token session cookie. Accepting a Bearer here can cause 403 when a frontend userToken
      // (non-admin JWT) arrives alongside X-Framework-Client: admin-ui from the visual editor.
      const isAdminCtx = this.isAdminRequestContext(req);
      const authHeader = req.headers.authorization;
      if (!isAdminCtx && authHeader && authHeader.startsWith('Bearer ')) {
        const t = authHeader.split(' ')[1];
        if (t && t !== 'undefined' && t !== 'null') {
          tokenCandidates.push(t);
        }
      }

      if (req.headers.cookie) {
        const rawCookies = String(req.headers.cookie).split(';');
        rawCookies.forEach((c) => {
          const parts = c.trim().split('=');
          if (parts.length >= 2) {
            const name = parts[0].trim();
            const value = parts.slice(1).join('=').trim();
            if (sessionCookieNames.includes(name) && value && value !== 'undefined' && value !== 'null') {
              tokenCandidates.push(value);
            }
          }
        });
      }

      sessionCookieNames.forEach((cookieName) => {
        if (!req.cookies?.[cookieName]) {
          return;
        }

        if (Array.isArray(req.cookies[cookieName])) {
          req.cookies[cookieName].forEach((t: string) => {
            if (t && !tokenCandidates.includes(t)) tokenCandidates.push(t);
          });
          return;
        }

        if (typeof req.cookies[cookieName] === 'string' && !tokenCandidates.includes(req.cookies[cookieName])) {
          tokenCandidates.push(req.cookies[cookieName]);
        }
      });

      let hasExpiredToken = false;
      for (const t of tokenCandidates) {
        try {
          // Tenant resolution runs before authentication and publishes the tenant selected by the
          // host / admin session / API-key gate on the request. Bind the signed session to that exact
          // tenant here. Without this comparison a tenant-A admin token presented as a frontend Bearer
          // token could be replayed while the request itself was scoped to tenant B; downstream role
          // guards saw only `admin` and the database correctly served the *request* tenant.
          const tenantId = String(req.tenantId ?? '').trim();
          const user = await this.verifyToken(t, tenantId ? { tenantId } : {});
          if (user) {
            req.user = await this.applyTenantRoles(user, tenantId);
            this.logger.debug(`Session validated for ${req.url || 'unknown'}`);
            break;
          }
        } catch (err: any) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('expired')) {
            hasExpiredToken = true;
          }
          this.logger.debug(`Token candidate failed: ${msg}`);
        }
      }

      if (tokenCandidates.length > 0 && !req.user) {
        if (this.shouldLogTokenFailure(req.url)) {
          this.logger.warn(`All ${tokenCandidates.length} token candidates failed for ${req.url}`);
        }

        if (hasExpiredToken && res.clearCookie) {
          this.logger.info(`Expired token detected for ${req.url}. Clearing this surface's session cookie.`);

          const isProd = process.env.NODE_ENV === 'production';
          const isHttps = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' || req.get('x-forwarded-port') === '443';

          const baseOptions: any = {
            path: '/',
            httpOnly: true,
            secure: isProd && isHttps,
            sameSite: 'lax'
          };

          // ONLY this surface's session cookie. Admin (`fc_token`) and storefront (`userToken`) are
          // deliberately separate sessions so one person can be an admin in one tab and a customer in
          // another; clearing both meant a storefront token aging out silently killed the admin session,
          // which the operator experiences as "I clicked something and it logged me out".
          //
          // `fc_csrf` is deliberately NOT cleared: it is a single shared, identity-free token that the
          // CSRF middleware regenerates on the next status/health GET, so clearing it here only breaks
          // the OTHER surface's in-flight writes.
          let domain = process.env.COOKIE_DOMAIN;
          if (!domain && req.hostname && req.hostname.includes('.') && !req.hostname.match(/^\d+\.\d+\.\d+\.\d+$/) && req.hostname !== 'localhost') {
            const parts = req.hostname.split('.');
            if (parts.length >= 2) {
              domain = '.' + parts.slice(-2).join('.');
            }
          }

          for (const cookieName of sessionCookieNames) {
            // The storefront token is readable by its client, the admin token is httpOnly.
            const httpOnly = cookieName !== CookieConstants.CLIENT_AUTH_TOKEN;
            res.clearCookie(cookieName, { ...baseOptions, httpOnly });
            if (domain) {
              res.clearCookie(cookieName, { ...baseOptions, domain, httpOnly });
            }
          }
        }
      }

      next();
    };
  }

  private getSessionCookieNames(req: any): string[] {
    return this.isAdminRequestContext(req)
      ? [CookieConstants.AUTH_TOKEN]
      : [CookieConstants.CLIENT_AUTH_TOKEN];
  }

  private isAdminRequestContext(req: any): boolean {
    return RequestSurfaceUtils.isAdminRequestContext(req);
  }

  private shouldLogTokenFailure(requestUrl: unknown): boolean {
    const path = String(requestUrl || '').split('?')[0].split('#')[0].trim();
    if (!path) {
      return false;
    }

    if (/\.(?:css|js|map|png|jpe?g|gif|svg|ico|woff2?|ttf|eot)$/i.test(path)) {
      return false;
    }

    const lastSegment = path.split('/').filter(Boolean).pop() || '';
    return lastSegment !== RouteConstants.SEGMENTS.STATUS.slice(1)
      && lastSegment !== RouteConstants.SEGMENTS.HEALTH.slice(1)
      && lastSegment !== RouteConstants.SEGMENTS.READY.slice(1);
  }

  /**
   * Requires an API-TOKEN identity specifically — a session cookie is not enough.
   *
   * The MCP surface is machine-to-machine and every call is scoped and audited against a token
   * record. Allowing a browser session through would hand a logged-in admin's tab the full tool
   * surface with no scopes attached, since scopes live on the token and a session has none.
   */
  requireApiToken() {
    return (req: any, res: any, next: any) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized: missing or invalid token' });
      }
      if (req.user.isApiKey !== true) {
        return res.status(403).json({ error: 'Forbidden: this endpoint requires an API token' });
      }
      next();
    };
  }

  guard(roles: string[] = []) {
    return (req: any, res: any, next: any) => {
      if (!req.user) {
        this.logger.warn(`Guard failed: No user on request for ${req.method} ${req.url}`);
        return res.status(401).json({ error: 'Unauthorized: missing or invalid token' });
      }

      if (roles.length > 0) {
        const hasRole = roles.some((role) => req.user.roles.includes(role));
        if (!hasRole) {
          return res.status(403).json({ error: 'Forbidden: insufficient permissions' });
        }
      }

      next();
    };
  }

  requirePermission(permission: string | string[]) {
    return async (req: any, res: any, next: any) => {
      if (!req.user) {
        this.logger.warn(`Permission guard failed: No user on request for ${req.method} ${req.url}`);
        return res.status(401).json({ error: 'Unauthorized: missing or invalid token' });
      }

      if (!this.permissionChecker) {
        // Fail closed: without a configured permission checker we cannot evaluate
        // fine-grained permissions, so deny for everyone rather than silently
        // degrading to a coarse role check.
        this.logger.error(
          `Permission checker not configured — denying request requiring "${Array.isArray(permission) ? permission.join(', ') : permission}". ` +
          'Call setPermissionChecker() during auth bootstrap.'
        );
        return res.status(503).json({
          error: 'Service Unavailable: permission system not configured',
          required: permission
        });
      }

      const permissions = Array.isArray(permission) ? permission : [permission];
      // Against the roles IN EFFECT for this request — which on a multi-tenant deployment are the
      // account's roles on the site it is acting in (narrowed by `applyTenantRoles` above), not the
      // account's global ones. Resolving globally here is what made a site administrator's `admin`
      // role decorative: `guard(['admin'])` let it through and every permission-gated screen behind
      // that guard refused it, because the account is a plain customer everywhere else.
      const effectiveRoles: string[] = Array.isArray(req.user.roles) ? req.user.roles : [];
      const userId = parseInt(req.user.id);

      let hasPermission = false;
      for (const perm of permissions) {
        const granted = effectiveRoles.length > 0
          ? await this.permissionChecker.hasPermissionForRoles(effectiveRoles, perm)
          : await this.permissionChecker.hasPermission(userId, perm);
        if (granted) {
          hasPermission = true;
          break;
        }
      }

      if (!hasPermission) {
        this.logger.warn(`Permission denied for user ${req.user.email}: requires ${permissions.join(' OR ')}`);
        return res.status(403).json({
          error: 'Forbidden: missing required permission',
          required: permissions
        });
      }

      next();
    };
  }
}

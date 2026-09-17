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
import { AuthRequestGate } from '@auth/auth-request-gate';

export class AuthManager {
  private secret: string;
  private tenantRoleResolver?: (userId: string, tenantId: string) => Promise<string[] | null>;
  private sessionValidator?: ISessionValidator;
  private apiKeyValidator?: IApiKeyValidator;
  private permissionChecker?: UserPermissionChecker;
  private logger = new Logger({ namespace: 'auth-manager' });
  private readonly tokens: AuthTokenService;

  private readonly gate: AuthRequestGate;

  constructor(secret: string = process.env.JWT_SECRET || '') {
    if (!secret) {
      throw new Error('AuthManager: JWT_SECRET must be set in environment variables. No default is allowed for security.');
    }
    this.secret = secret;
    this.tokens = new AuthTokenService(this.secret, () => this.sessionValidator);
    this.gate = new AuthRequestGate(
      this.logger,
      (token, expected) => this.verifyToken(token, expected),
      (user, tenantId) => this.applyTenantRoles(user, tenantId),
      () => this.apiKeyValidator ?? null,
      () => this.permissionChecker ?? null,
    );
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

  /** @see AuthRequestGate.middleware */
  middleware(...args: Parameters<AuthRequestGate["middleware"]>): ReturnType<AuthRequestGate["middleware"]> {
    return this.gate.middleware(...args);
  }

  /** @see AuthRequestGate.requireApiToken */
  requireApiToken(...args: Parameters<AuthRequestGate["requireApiToken"]>): ReturnType<AuthRequestGate["requireApiToken"]> {
    return this.gate.requireApiToken(...args);
  }

  /** @see AuthRequestGate.guard */
  guard(...args: Parameters<AuthRequestGate["guard"]>): ReturnType<AuthRequestGate["guard"]> {
    return this.gate.guard(...args);
  }

  /** @see AuthRequestGate.requirePermission */
  requirePermission(...args: Parameters<AuthRequestGate["requirePermission"]>): ReturnType<AuthRequestGate["requirePermission"]> {
    return this.gate.requirePermission(...args);
  }

}

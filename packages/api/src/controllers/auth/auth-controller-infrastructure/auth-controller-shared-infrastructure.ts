import { Request } from 'express';
import { AuthManager } from '@fromcode119/auth';
import {
  ApplicationUrlUtils,
  BaseController,
  CookieConstants,
  Logger,
  PluginManager,
  RequestSurfaceUtils,
  SystemConstants,
} from '@fromcode119/core';
import type { IDatabaseManager } from '@fromcode119/database';
import { ApiUrlUtils } from '../../../utils/url';
import { AuthUtils } from '../../../utils/auth';

export class AuthControllerSharedInfrastructure extends BaseController {
  protected db: IDatabaseManager;
  protected logger = new Logger({ namespace: 'auth-controller' });
  protected readonly defaultSessionDurationMinutes = 10080; // 7 days
  protected readonly minSessionDurationMinutes = 15;
  protected readonly maxSessionDurationMinutes = 43200; // 30 days
  protected readonly defaultPasswordResetExpiryMinutes = 30;
  protected readonly defaultEmailChangeExpiryMinutes = 60;

  constructor(protected readonly manager: PluginManager, protected readonly auth: AuthManager) {
    super();
    this.db = manager.db;
  }

  protected readRoles(user: any): string[] {
    return AuthUtils.parseRoles(user?.roles);
  }

  /**
   * Effective roles = the legacy `users.roles` column UNION the assignable `_system_users_roles`
   * junction roles (managed by the admin Roles UI and plugins like MLM). Without this union, role
   * assignments made through the junction table would never reach auth/runtime — the role would be
   * cosmetic. Reads go through the raw DB manager, so the junction row is snake_case (`role_slug`),
   * the framework-internal convention for raw-manager access.
   */
  protected async resolveEffectiveRoles(user: any): Promise<string[]> {
    const base = AuthUtils.parseRoles(user?.roles);
    const userId = this.parseUserId(user?.id ?? user?.userId);
    if (!userId) return base;
    const rows = await this.db
      .find(SystemConstants.TABLE.USERS_ROLES, { where: { userId } })
      .catch(() => [] as any[]);
    const assigned = (Array.isArray(rows) ? rows : [])
      .map((row: any) => String(row?.role_slug ?? '').trim())
      .filter(Boolean);
    return Array.from(new Set([...base, ...assigned]));
  }

  protected parseUserId(raw: any): number {
    return AuthUtils.parseUserId(raw);
  }

  protected normalizeEmail(email: any): string {
    return AuthUtils.normalizeEmail(email);
  }

  protected readUserFirstName(user: any): string {
    return String(user?.firstName || user?.first_name || '').trim();
  }

  protected readUserLastName(user: any): string {
    return String(user?.lastName || user?.last_name || '').trim();
  }

  protected isValidEmail(email: string): boolean {
    return AuthUtils.isValidEmail(email);
  }

  protected hashToken(token: string): string {
    return AuthUtils.hashToken(token);
  }

  protected hashRecoveryCode(code: string): string {
    return AuthUtils.hashRecoveryCode(code);
  }

  protected async readMetaRow(key: string): Promise<any | null> {
    return this.db.findOne(SystemConstants.TABLE.META, { key });
  }

  protected async getMetaValue(key: string): Promise<string | null> {
    const row = await this.readMetaRow(key);
    if (!row) return null;
    return String(row.value || '');
  }

  protected async upsertMeta(key: string, value: string) {
    const existing = await this.db.findOne(SystemConstants.TABLE.META, { key });
    if (existing) {
      await this.db.update(SystemConstants.TABLE.META, { key }, { value });
      return;
    }
    await this.db.insert(SystemConstants.TABLE.META, { key, value });
  }

  protected async deleteMeta(key: string) {
    await this.db.delete(SystemConstants.TABLE.META, { key });
  }

  protected getRequestHostAndProto(req: Request): { host: string; proto: string } {
    return ApiUrlUtils.getRequestHostAndProto(req);
  }

  protected getRequestOriginBaseUrl(req: Request): string {
    return ApiUrlUtils.getRequestOrigin(req);
  }

  protected isAdminRequestContext(req: Request): boolean {
    return RequestSurfaceUtils.isAdminRequestContext(req);
  }

  protected getSessionCookieName(req: Request): string {
    return this.isAdminRequestContext(req)
      ? CookieConstants.AUTH_TOKEN
      : CookieConstants.CLIENT_AUTH_TOKEN;
  }

  protected async resolveFrameworkAppName(): Promise<string> {
    const platformName = String((await this.getMetaValue(SystemConstants.META_KEY.PLATFORM_NAME)) || '').trim();
    if (platformName) {
      return platformName;
    }

    const siteName = String((await this.getMetaValue(SystemConstants.META_KEY.SITE_NAME)) || '').trim();
    if (siteName) {
      return siteName;
    }

    const envAppName = String(process.env.APP_NAME || '').trim();
    if (envAppName) {
      return envAppName;
    }

    return 'Fromcode';
  }

  protected async resolveFrameworkSenderAddress(): Promise<string> {
    const platformDomain = await this.resolveFrameworkPlatformDomain();
    if (platformDomain) {
      return `no-reply@${platformDomain}`;
    }

    const envSender = String(process.env.EMAIL_FROM || process.env.SMTP_FROM || '').trim();
    if (envSender) {
      return envSender;
    }

    return 'no-reply@localhost';
  }

  protected async resolveFrameworkSenderIdentity(): Promise<string> {
    const appName = await this.resolveFrameworkAppName();
    const senderAddress = await this.resolveFrameworkSenderAddress();
    const normalizedAppName = appName.replace(/"/g, '\\"').trim();
    if (!normalizedAppName) {
      return senderAddress;
    }

    return `"${normalizedAppName}" <${senderAddress}>`;
  }

  protected async resolveFrameworkPlatformDomain(): Promise<string> {
    const configuredPlatformDomain = String((await this.getMetaValue(SystemConstants.META_KEY.PLATFORM_DOMAIN)) || '').trim().toLowerCase();
    if (configuredPlatformDomain) {
      return configuredPlatformDomain;
    }

    const derivedDomain = ApplicationUrlUtils.derivePlatformDomain(
      await this.getMetaValue(SystemConstants.META_KEY.SITE_URL),
      await this.getMetaValue(SystemConstants.META_KEY.FRONTEND_URL),
      await this.getMetaValue(SystemConstants.META_KEY.ADMIN_URL),
      ApplicationUrlUtils.readAppBaseUrlFromEnvironment(ApplicationUrlUtils.FRONTEND_APP),
      ApplicationUrlUtils.readAppBaseUrlFromEnvironment(ApplicationUrlUtils.ADMIN_APP),
      ApplicationUrlUtils.readAppBaseUrlFromEnvironment(ApplicationUrlUtils.API_APP),
    );
    if (derivedDomain) {
      return derivedDomain;
    }

    return '';
  }
}

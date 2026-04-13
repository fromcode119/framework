import { Request, Response } from 'express';
import { AuthManager } from '@fromcode119/auth';
import {
  ApplicationUrlUtils,
  AppPathConstants,
  CookieConstants,
  Logger,
  PluginManager,
  RequestSurfaceUtils,
  SystemConstants,
} from '@fromcode119/core';
import type { IDatabaseManager } from '@fromcode119/database';
import { ApiConfig } from '../../config/api-config';
import { ApiUrlUtils } from '../../utils/url';
import { AuthUtils } from '../../utils/auth';

export class AuthControllerInfrastructure {
  protected db: IDatabaseManager;
  protected logger = new Logger({ namespace: 'auth-controller' });
  protected readonly defaultSessionDurationMinutes = 10080; // 7 days
  protected readonly minSessionDurationMinutes = 15;
  protected readonly maxSessionDurationMinutes = 43200; // 30 days
  protected readonly defaultPasswordResetExpiryMinutes = 30;
  protected readonly defaultEmailChangeExpiryMinutes = 60;

  constructor(protected readonly manager: PluginManager, protected readonly auth: AuthManager) {
    this.db = manager.db;
  }

  protected readRoles(user: any): string[] {
    return AuthUtils.parseRoles(user?.roles);
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

  protected async getFrontendBaseUrl(req: Request): Promise<string> {
    const configuredInDb = String((await this.getMetaValue(SystemConstants.META_KEY.FRONTEND_URL)) || '').trim();
    if (configuredInDb) return configuredInDb.replace(/\/+$/, '');

    const configured =
      process.env.FRONTEND_URL ||
      process.env.PUBLIC_APP_URL ||
      process.env.APP_URL;

    if (configured) return configured.replace(/\/+$/, '');

    const refererUrl = RequestSurfaceUtils.readRefererUrl(req);
    if (refererUrl && RequestSurfaceUtils.isFrontendPath(refererUrl.pathname)) {
      return `${refererUrl.protocol}//${refererUrl.host}`.replace(/\/+$/, '');
    }

    const siteUrl = String((await this.getMetaValue(SystemConstants.META_KEY.SITE_URL)) || '').trim();
    if (siteUrl) return siteUrl.replace(/\/+$/, '');

    const requestOrigin = this.getRequestOriginBaseUrl(req);
    if (requestOrigin) return requestOrigin.replace(/\/+$/, '');

    throw new Error('Frontend base URL is not configured. Set frontend_url or provide a resolvable request origin.');
  }

  protected async getAdminBaseUrl(req: Request): Promise<string> {
    const configuredInDb = String((await this.getMetaValue(SystemConstants.META_KEY.ADMIN_URL)) || '').trim();
    if (configuredInDb) return this.normalizeAdminBaseUrl(configuredInDb);

    const configured =
      process.env.ADMIN_URL;
    if (configured) return this.normalizeAdminBaseUrl(configured);

    const refererUrl = RequestSurfaceUtils.readRefererUrl(req);
    if (refererUrl && RequestSurfaceUtils.isAdminPath(refererUrl.pathname)) {
      return `${refererUrl.protocol}//${refererUrl.host}${AppPathConstants.ADMIN.ADMIN.BASE}`.replace(/\/+$/, '');
    }

    const { host, proto } = ApiUrlUtils.getRequestHostAndProto(req);
    if (host) {
      return `${proto}://${host}${AppPathConstants.ADMIN.ADMIN.BASE}`;
    }

    const siteUrl = String((await this.getMetaValue(SystemConstants.META_KEY.SITE_URL)) || '').trim();
    if (siteUrl) {
      return this.joinBaseUrl(siteUrl, AppPathConstants.ADMIN.ADMIN.BASE);
    }

    const requestOrigin = this.getRequestOriginBaseUrl(req);
    if (requestOrigin) {
      return this.joinBaseUrl(requestOrigin, AppPathConstants.ADMIN.ADMIN.BASE);
    }

    throw new Error('Admin base URL is not configured. Set admin_url or provide a resolvable request origin.');
  }

  protected isAdminRequestContext(req: Request): boolean {
    return RequestSurfaceUtils.isAdminRequestContext(req);
  }

  protected getSessionCookieName(req: Request): string {
    return this.isAdminRequestContext(req)
      ? CookieConstants.AUTH_TOKEN
      : CookieConstants.CLIENT_AUTH_TOKEN;
  }

  protected clearConflictingSessionCookies(req: Request, res: Response) {
    const cookieOptions = this.getCookieOptions(req, true);

    if (this.isAdminRequestContext(req)) {
      this.clearCookieVariants(res, CookieConstants.CLIENT_AUTH_TOKEN, cookieOptions, false);
      return;
    }

    this.clearCookieVariants(res, CookieConstants.AUTH_TOKEN, cookieOptions, false);
    this.clearCookieVariants(res, CookieConstants.AUTH_USER, cookieOptions, false);
    this.clearCookieVariants(res, CookieConstants.ADMIN_EXPORT_AUTH_TOKEN, cookieOptions, false);
  }

  protected async buildEmailVerificationUrl(req: Request, token: string): Promise<string> {
    const baseUrl = await this.getFrontendBaseUrl(req);
    return `${baseUrl}${ApiConfig.getInstance().appRoutes.auth.VERIFY_EMAIL}?token=${encodeURIComponent(token)}`;
  }

  protected async buildPasswordResetUrl(req: Request, token: string, contextHint?: string): Promise<string> {
    const normalizedContextHint = this.normalizeResetContextHint(contextHint);
    let baseUrl = '';
    if (normalizedContextHint === 'admin') {
      baseUrl = await this.getAdminBaseUrl(req);
    } else if (normalizedContextHint === 'frontend') {
      baseUrl = await this.getFrontendBaseUrl(req);
    } else if (this.isAdminRequestContext(req)) {
      baseUrl = await this.getAdminBaseUrl(req);
    } else {
      baseUrl = await this.getFrontendBaseUrl(req);
    }
    return `${baseUrl}${ApiConfig.getInstance().appRoutes.auth.RESET_PASSWORD}?token=${encodeURIComponent(token)}`;
  }

  protected async buildEmailChangeUrl(req: Request, token: string): Promise<string> {
    const baseUrl = await this.getFrontendBaseUrl(req);
    return `${baseUrl}${ApiConfig.getInstance().appRoutes.auth.VERIFY_EMAIL_CHANGE}?token=${encodeURIComponent(token)}`;
  }

  protected async sendVerificationEmail(options: { to: string; verificationUrl: string; firstName?: string }): Promise<boolean> {
    const recipientName = String(options.firstName || '').trim();
    const greeting = recipientName ? `Hi ${recipientName},` : 'Hi,';
    const appName = process.env.APP_NAME || 'Fromcode';
    const fromAddress = process.env.EMAIL_FROM || process.env.SMTP_FROM || 'no-reply@fromcode.com';
    const subject = `${appName}: Verify your email`;
    const text = `${greeting}\n\nPlease verify your email by opening the link below:\n${options.verificationUrl}\n\nIf you did not create this account, you can ignore this message.`;
    const html = `<p>${greeting}</p><p>Please verify your email by clicking the button below.</p><p><a href="${options.verificationUrl}" style="display:inline-block;padding:10px 16px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:8px;">Verify Email</a></p><p>If the button does not work, copy and paste this URL:</p><p>${options.verificationUrl}</p>`;

    return this.sendEmail({ to: options.to, subject, text, html, from: fromAddress }, '[AuthController] Failed to send verification email');
  }

  protected async sendPasswordResetEmail(options: { to: string; resetUrl: string; firstName?: string }): Promise<boolean> {
    const recipientName = String(options.firstName || '').trim();
    const greeting = recipientName ? `Hi ${recipientName},` : 'Hi,';
    const appName = process.env.APP_NAME || 'Fromcode';
    const fromAddress = process.env.EMAIL_FROM || process.env.SMTP_FROM || 'no-reply@fromcode.com';
    const subject = `${appName}: Reset your password`;
    const text = `${greeting}\n\nA password reset was requested for your account.\nOpen this link to continue:\n${options.resetUrl}\n\nIf you did not request this, you can ignore this email.`;
    const html = `<p>${greeting}</p><p>A password reset was requested for your account.</p><p><a href="${options.resetUrl}" style="display:inline-block;padding:10px 16px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:8px;">Reset Password</a></p><p>If the button does not work, copy and paste this URL:</p><p>${options.resetUrl}</p>`;

    return this.sendEmail({ to: options.to, subject, text, html, from: fromAddress }, '[AuthController] Failed to send password reset email');
  }

  protected async sendEmailChangeVerificationEmail(options: { to: string; confirmUrl: string; firstName?: string }): Promise<boolean> {
    const recipientName = String(options.firstName || '').trim();
    const greeting = recipientName ? `Hi ${recipientName},` : 'Hi,';
    const appName = process.env.APP_NAME || 'Fromcode';
    const fromAddress = process.env.EMAIL_FROM || process.env.SMTP_FROM || 'no-reply@fromcode.com';
    const subject = `${appName}: Confirm your new email`;
    const text = `${greeting}\n\nUse this link to confirm your new email address:\n${options.confirmUrl}\n\nIf you did not request this, ignore this message.`;
    const html = `<p>${greeting}</p><p>Use the button below to confirm your new email address.</p><p><a href="${options.confirmUrl}" style="display:inline-block;padding:10px 16px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:8px;">Confirm Email Change</a></p><p>If the button does not work, copy and paste this URL:</p><p>${options.confirmUrl}</p>`;

    return this.sendEmail({ to: options.to, subject, text, html, from: fromAddress }, '[AuthController] Failed to send email-change verification email');
  }

  protected async sendSecurityNotification(options: {
    userId: number;
    to: string;
    subject: string;
    title: string;
    details?: string[];
    allowSilentFailure?: boolean;
  }) {
    const enabled = await this.getSettingBoolean(SystemConstants.META_KEY.AUTH_SECURITY_NOTIFICATIONS, true);
    if (!enabled) return;

    const fromAddress = process.env.EMAIL_FROM || process.env.SMTP_FROM || 'no-reply@fromcode.com';
    const details = Array.isArray(options.details) ? options.details.filter(Boolean) : [];
    const text = `${options.title}\n\n${details.join('\n')}`;
    const html = `<p>${options.title}</p>${details.length > 0 ? `<ul>${details.map((line) => `<li>${line}</li>`).join('')}</ul>` : ''}`;
    const ok = await this.sendEmail({
      to: options.to,
      from: fromAddress,
      subject: `${process.env.APP_NAME || 'Fromcode'}: ${options.subject}`,
      text,
      html
    }, '[AuthController] Failed to send security notification');

    if (!ok && !options.allowSilentFailure) {
      await this.manager.writeLog(
        'WARN',
        `Security notification failed: ${options.subject}`,
        'system',
        { userId: options.userId, email: options.to }
      ).catch(() => {});
    }
  }

  protected async sendEmail(payload: { to: string; from: string; subject: string; text: string; html: string }, logPrefix: string): Promise<boolean> {
    try {
      await this.manager.email.send(payload);
      return true;
    } catch (error: any) {
      this.logger.error(`${logPrefix}: ${error?.message || error}`);
      return false;
    }
  }

  protected clearAuthCookies(req: Request, res: Response) {
    const cookieOptions = this.getCookieOptions(req, true);
    this.clearCookieVariants(res, CookieConstants.AUTH_TOKEN, cookieOptions, false);
    this.clearCookieVariants(res, CookieConstants.CLIENT_AUTH_TOKEN, cookieOptions, false);
    this.clearCookieVariants(res, CookieConstants.AUTH_CSRF, cookieOptions, false);
    this.clearCookieVariants(res, CookieConstants.AUTH_USER, cookieOptions, false);
    this.clearCookieVariants(res, CookieConstants.ADMIN_EXPORT_AUTH_TOKEN, cookieOptions, false);
  }

  protected clearCookieVariants(res: Response, name: string, cookieOptions: Record<string, any>, httpOnly: boolean) {
    res.clearCookie(name, { ...cookieOptions, httpOnly });
    const hostOptions = { ...cookieOptions } as any;
    delete hostOptions.domain;
    res.clearCookie(name, { ...hostOptions, httpOnly });
  }

  protected getCookieOptions(req: Request, isLogout = false, maxAgeMs?: number) {
    const isProd = process.env.NODE_ENV === 'production';
    const secure = isProd && ApiUrlUtils.isHttps(req);

    const options: any = {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/'
    };

    if (!isLogout) {
      options.maxAge = maxAgeMs || this.defaultSessionDurationMinutes * 60 * 1000;
    }

    let domain = process.env.COOKIE_DOMAIN || ApiUrlUtils.getCookieDomain(req);

    if (domain) {
      options.domain = domain;
    }

    return options;
  }

  // Implemented in policy layer. Defined here so infrastructure can call it.
  protected async getSettingBoolean(_key: string, defaultValue: boolean): Promise<boolean> {
    return defaultValue;
  }

  // Implemented in policy layer. Defined here so infrastructure can call it.
  protected async getSettingNumber(_key: string, defaultValue: number, _min: number, _max: number): Promise<number> {
    return defaultValue;
  }

  protected normalizeResetContextHint(contextHint?: string): string {
    const normalizedHint = String(contextHint || '').trim().toLowerCase();
    if (normalizedHint === 'admin' || normalizedHint === RequestSurfaceUtils.CLIENTS.ADMIN_UI) {
      return 'admin';
    }
    if (normalizedHint === 'frontend' || normalizedHint === RequestSurfaceUtils.CLIENTS.FRONTEND_UI) {
      return 'frontend';
    }
    return '';
  }

  protected joinBaseUrl(baseUrl: string, path: string): string {
    return `${String(baseUrl || '').replace(/\/+$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
  }

  protected normalizeAdminBaseUrl(baseUrl: string): string {
    const normalizedBaseUrl = String(baseUrl || '').trim().replace(/\/+$/, '');
    if (!normalizedBaseUrl) {
      return '';
    }

    const configuredBasePath = ApplicationUrlUtils.readAppBasePathFromEnvironment(ApplicationUrlUtils.ADMIN_APP)
      || AppPathConstants.ADMIN.ADMIN.BASE;
    if (!configuredBasePath || configuredBasePath === '/') {
      return normalizedBaseUrl;
    }

    const existingPath = ApplicationUrlUtils.deriveBasePathFromUrl(normalizedBaseUrl, '');
    if (existingPath) {
      return normalizedBaseUrl;
    }

    return this.joinBaseUrl(normalizedBaseUrl, configuredBasePath);
  }
}

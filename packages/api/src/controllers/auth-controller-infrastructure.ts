import { Request, Response } from 'express';
import { AuthManager } from '@fromcode/auth';
import { PluginManager } from '@fromcode/core';
import { APP_ROUTES } from '../constants';
import { createHash } from 'crypto';

export class AuthControllerInfrastructure {
  protected db: any;
  protected readonly defaultSessionDurationMinutes = 10080; // 7 days
  protected readonly minSessionDurationMinutes = 15;
  protected readonly maxSessionDurationMinutes = 43200; // 30 days
  protected readonly defaultPasswordResetExpiryMinutes = 30;
  protected readonly defaultEmailChangeExpiryMinutes = 60;

  constructor(protected readonly manager: PluginManager, protected readonly auth: AuthManager) {
    this.db = (manager as any).db.drizzle;
  }

  protected readRoles(user: any): string[] {
    if (!user) return [];
    if (Array.isArray(user.roles)) return user.roles.map((role: any) => String(role));
    if (typeof user.roles === 'string') {
      try {
        const parsed = JSON.parse(user.roles);
        if (Array.isArray(parsed)) return parsed.map((role) => String(role));
      } catch {}
    }
    return [];
  }

  protected parseUserId(raw: any): number {
    const parsed = Number.parseInt(String(raw || ''), 10);
    if (Number.isNaN(parsed) || parsed <= 0) return 0;
    return parsed;
  }

  protected normalizeEmail(email: any): string {
    return String(email || '').trim().toLowerCase();
  }

  protected isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  protected hashToken(token: string): string {
    return createHash('sha256').update(String(token || '').trim()).digest('hex');
  }

  protected hashRecoveryCode(code: string): string {
    return createHash('sha256').update(String(code || '').trim().toUpperCase()).digest('hex');
  }

  protected async readMetaRow(key: string): Promise<any | null> {
    const db = (this.manager as any).db;
    return db.findOne('_system_meta', { key });
  }

  protected async getMetaValue(key: string): Promise<string | null> {
    const row = await this.readMetaRow(key);
    if (!row) return null;
    return String(row.value || '');
  }

  protected async upsertMeta(key: string, value: string) {
    const db = (this.manager as any).db;
    const existing = await db.findOne('_system_meta', { key });
    if (existing) {
      await db.update('_system_meta', { key }, { value });
      return;
    }
    await db.insert('_system_meta', { key, value });
  }

  protected async deleteMeta(key: string) {
    const db = (this.manager as any).db;
    await db.delete('_system_meta', { key });
  }

  protected getRequestHostAndProto(req: Request): { host: string; proto: string } {
    const host = String(req.get('x-forwarded-host') || req.get('host') || '').split(',')[0].trim();
    const proto = String(req.get('x-forwarded-proto') || req.protocol || 'http').split(',')[0].trim();
    return { host, proto: proto || 'http' };
  }

  protected getRequestOriginBaseUrl(req: Request): string {
    const candidates = [req.get('origin'), req.get('referer')];
    for (const raw of candidates) {
      const value = String(raw || '').trim();
      if (!value) continue;
      try {
        const parsed = new URL(value);
        return `${parsed.protocol}//${parsed.host}`;
      } catch {
        continue;
      }
    }
    return '';
  }

  protected async getFrontendBaseUrl(req: Request): Promise<string> {
    const configuredInDb = String((await this.getMetaValue('frontend_url')) || '').trim();
    if (configuredInDb) return configuredInDb.replace(/\/+$/, '');

    const configured =
      process.env.FRONTEND_URL ||
      process.env.NEXT_PUBLIC_FRONTEND_URL ||
      process.env.PUBLIC_APP_URL;
    if (configured) return configured.replace(/\/+$/, '');

    const { host, proto } = this.getRequestHostAndProto(req);
    if (host) {
      if (host.startsWith('api.')) {
        return `${proto}://${host.replace(/^api\./, 'frontend.')}`;
      }
      return `${proto}://${host}`;
    }

    return 'http://frontend.framework.local';
  }

  protected getAdminBaseUrl(req: Request): string {
    const configured =
      process.env.ADMIN_URL ||
      process.env.NEXT_PUBLIC_ADMIN_URL;
    if (configured) return configured.replace(/\/+$/, '');

    const originBase = this.getRequestOriginBaseUrl(req);
    if (originBase) {
      try {
        const parsed = new URL(originBase);
        if (parsed.hostname.startsWith('admin.')) {
          return originBase.replace(/\/+$/, '');
        }
      } catch {}
    }

    const { host, proto } = this.getRequestHostAndProto(req);
    if (host) {
      if (host.startsWith('api.')) {
        return `${proto}://${host.replace(/^api\./, 'admin.')}`;
      }
      if (host.startsWith('frontend.')) {
        return `${proto}://${host.replace(/^frontend\./, 'admin.')}`;
      }
      return `${proto}://${host}`;
    }

    return 'http://admin.framework.local';
  }

  protected isAdminRequestContext(req: Request): boolean {
    const clientHeader = String(req.get('x-framework-client') || '').toLowerCase();
    if (clientHeader.includes('admin')) return true;

    const originBase = this.getRequestOriginBaseUrl(req);
    if (originBase) {
      try {
        return new URL(originBase).hostname.startsWith('admin.');
      } catch {
        return false;
      }
    }

    return false;
  }

  protected async buildEmailVerificationUrl(req: Request, token: string): Promise<string> {
    const baseUrl = await this.getFrontendBaseUrl(req);
    return `${baseUrl}${APP_ROUTES.AUTH.VERIFY_EMAIL}?token=${encodeURIComponent(token)}`;
  }

  protected async buildPasswordResetUrl(req: Request, token: string, contextHint?: string): Promise<string> {
    const hint = String(contextHint || '').toLowerCase();
    const isAdminHint = hint.includes('admin');
    const isFrontendHint = hint.includes('frontend');
    let baseUrl = '';
    if (isAdminHint) {
      baseUrl = this.getAdminBaseUrl(req);
    } else if (isFrontendHint) {
      baseUrl = await this.getFrontendBaseUrl(req);
    } else if (this.isAdminRequestContext(req)) {
      baseUrl = this.getAdminBaseUrl(req);
    } else {
      baseUrl = await this.getFrontendBaseUrl(req);
    }
    return `${baseUrl}${APP_ROUTES.AUTH.RESET_PASSWORD}?token=${encodeURIComponent(token)}`;
  }

  protected async buildEmailChangeUrl(req: Request, token: string): Promise<string> {
    const baseUrl = await this.getFrontendBaseUrl(req);
    return `${baseUrl}${APP_ROUTES.AUTH.VERIFY_EMAIL_CHANGE}?token=${encodeURIComponent(token)}`;
  }

  protected async sendVerificationEmail(options: { to: string; verificationUrl: string; firstName?: string }): Promise<boolean> {
    const recipientName = String(options.firstName || '').trim();
    const greeting = recipientName ? `Hi ${recipientName},` : 'Hi,';
    const appName = process.env.APP_NAME || 'Fromcode';
    const fromAddress = process.env.EMAIL_FROM || process.env.SMTP_FROM || 'no-reply@framework.local';
    const subject = `${appName}: Verify your email`;
    const text = `${greeting}\n\nPlease verify your email by opening the link below:\n${options.verificationUrl}\n\nIf you did not create this account, you can ignore this message.`;
    const html = `<p>${greeting}</p><p>Please verify your email by clicking the button below.</p><p><a href="${options.verificationUrl}" style="display:inline-block;padding:10px 16px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:8px;">Verify Email</a></p><p>If the button does not work, copy and paste this URL:</p><p>${options.verificationUrl}</p>`;

    return this.sendEmail({ to: options.to, subject, text, html, from: fromAddress }, '[AuthController] Failed to send verification email');
  }

  protected async sendPasswordResetEmail(options: { to: string; resetUrl: string; firstName?: string }): Promise<boolean> {
    const recipientName = String(options.firstName || '').trim();
    const greeting = recipientName ? `Hi ${recipientName},` : 'Hi,';
    const appName = process.env.APP_NAME || 'Fromcode';
    const fromAddress = process.env.EMAIL_FROM || process.env.SMTP_FROM || 'no-reply@framework.local';
    const subject = `${appName}: Reset your password`;
    const text = `${greeting}\n\nA password reset was requested for your account.\nOpen this link to continue:\n${options.resetUrl}\n\nIf you did not request this, you can ignore this email.`;
    const html = `<p>${greeting}</p><p>A password reset was requested for your account.</p><p><a href="${options.resetUrl}" style="display:inline-block;padding:10px 16px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:8px;">Reset Password</a></p><p>If the button does not work, copy and paste this URL:</p><p>${options.resetUrl}</p>`;

    return this.sendEmail({ to: options.to, subject, text, html, from: fromAddress }, '[AuthController] Failed to send password reset email');
  }

  protected async sendEmailChangeVerificationEmail(options: { to: string; confirmUrl: string; firstName?: string }): Promise<boolean> {
    const recipientName = String(options.firstName || '').trim();
    const greeting = recipientName ? `Hi ${recipientName},` : 'Hi,';
    const appName = process.env.APP_NAME || 'Fromcode';
    const fromAddress = process.env.EMAIL_FROM || process.env.SMTP_FROM || 'no-reply@framework.local';
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
    const enabled = await this.getSettingBoolean('auth_security_notifications', true);
    if (!enabled) return;

    const fromAddress = process.env.EMAIL_FROM || process.env.SMTP_FROM || 'no-reply@framework.local';
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
      console.error(`${logPrefix}:`, error?.message || error);
      return false;
    }
  }

  protected clearAuthCookies(req: Request, res: Response) {
    const cookieOptions = this.getCookieOptions(req, true);
    res.clearCookie('fc_token', cookieOptions);
    res.clearCookie('fc_csrf', { ...cookieOptions, httpOnly: false });

    const hostOptions = { ...cookieOptions } as any;
    delete hostOptions.domain;
    res.clearCookie('fc_token', hostOptions);
    res.clearCookie('fc_csrf', { ...hostOptions, httpOnly: false });
  }

  protected getCookieOptions(req: Request, isLogout = false, maxAgeMs?: number) {
    const isProd = process.env.NODE_ENV === 'production';
    const isHttps = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https';

    const options: any = {
      httpOnly: true,
      secure: isProd && isHttps,
      sameSite: 'lax',
      path: '/'
    };

    if (!isLogout) {
      options.maxAge = maxAgeMs || this.defaultSessionDurationMinutes * 60 * 1000;
    }

    let domain = process.env.COOKIE_DOMAIN;

    if (!domain && req.hostname.includes('.') && !req.hostname.match(/^\d+\.\d+\.\d+\.\d+$/) && req.hostname !== 'localhost') {
      const parts = req.hostname.split('.');
      if (parts.length >= 2) {
        domain = '.' + parts.slice(-2).join('.');
      }
    }

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
}

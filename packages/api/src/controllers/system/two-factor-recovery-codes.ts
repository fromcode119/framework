import Handlebars from 'handlebars';
import path from 'path';
import type { FrameworkEmailSender } from '@fromcode119/core';
import { ApplicationUrlUtils, FrameworkEmailSenderService, Logger, SystemConstants, SecretService } from '@fromcode119/core';
import { AuthUtils } from '@api/utils/auth';
import { Schema } from '@fromcode119/database';
import { createHash, randomBytes } from 'crypto';
import { promises as fs } from 'fs';

/**
 * Recovery codes, and telling the account holder when their second factor changes.
 *
 * Codes are stored HASHED and never read back — a recovery code is a credential, so the only thing
 * that can be checked is whether a presented one matches, and a used one is marked rather than
 * deleted so "already used" stays distinguishable from "never existed".
 *
 * The security notification is sent on every change, including ones the account holder made
 * themselves. That is the point: an email nobody expected is how somebody finds out their account
 * was taken over.
 *
 * Split out of `SystemTwoFactorService` (319 lines), which owns enrolment and verification.
 */
export class TwoFactorRecoveryCodes {
  constructor(
    private readonly db: any,
    private readonly logger: any,
    private readonly integrations: any,
    private readonly emailGetter: any,
  ) {}

  getRecoveryCodesKey(userId: number) { return `user:${userId}:2fa_recovery_codes`; }

  generateRecoveryCodes(count: number = 10): string[] {
    const codes: string[] = [];
    while (codes.length < count) {
      const raw = randomBytes(5).toString('hex').toUpperCase();
      const formatted = `${raw.slice(0, 5)}-${raw.slice(5, 10)}`;
      if (!codes.includes(formatted)) codes.push(formatted);
    }
    return codes;
  }

  hashRecoveryCode(code: string): string {
    return createHash('sha256').update(code.toUpperCase().replace(/-/g, '')).digest('hex');
  }

  async readRecoveryCodeRecords(userId: number): Promise<Array<{ hash: string; usedAt: string | null; createdAt?: string }>> {
    const row = await this.db.findOne(SystemConstants.TABLE.META, { key: this.getRecoveryCodesKey(userId) });
    const raw = String(row?.value || '').trim();
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((e) => ({ hash: String(e?.hash || '').trim(), usedAt: e?.usedAt ? String(e.usedAt) : null, createdAt: e?.createdAt ? String(e.createdAt) : undefined })).filter((e) => !!e.hash);
    } catch { return []; }
  }

  async writeRecoveryCodeRecords(userId: number, records: Array<{ hash: string; usedAt: string | null; createdAt?: string }>) {
    const key = this.getRecoveryCodesKey(userId);
    await this.upsertMetaValue(key, JSON.stringify(records));
  }

  async upsertMetaValue(key: string, value: string) {
    const existing = await this.db.findOne(SystemConstants.TABLE.META, { key });
    if (existing) {
      await this.db.update(SystemConstants.TABLE.META, { key }, { value });
      return;
    }

    await this.db.insert(SystemConstants.TABLE.META, { key, value });
  }

  resolveErrorStatus(error: any): number {
    const message = String(error?.message || '').trim().toLowerCase();
    if (message.includes('user not found')) {
      return 404;
    }
    if (message.includes('disabled by the administrator')) {
      return 403;
    }
    if (
      message.includes('invalid') ||
      message.includes('not initiated') ||
      message.includes('must be enabled')
    ) {
      return 400;
    }
    return 500;
  }

  async sendSecurityNotification(options: { userId: number; subject: string; title: string; details?: string[] }) {
    try {
      const enabled = await this.db.findOne(SystemConstants.TABLE.META, { key: SystemConstants.META_KEY.AUTH_SECURITY_NOTIFICATIONS });
      if (String(enabled?.value || 'true').trim().toLowerCase() !== 'true') return;
      const user = await this.db.findOne(Schema.users, { id: options.userId });
      const recipient = AuthUtils.normalizeEmail(user?.email);
      if (!recipient) return;
      const appName = await this.resolveFrameworkAppName();
      const sender = await this.resolveFrameworkSender();
      if (!sender.isConfigured) {
        this.logger.error(
          `[System2FA] Security notification not sent: no sender address is configured. Set ${FrameworkEmailSenderService.SETTING_HINT}.`,
        );
        return;
      }
      const from = sender.identity;
      const details = Array.isArray(options.details) ? options.details.filter(Boolean) : [];
      const html = await this.renderSecurityNotificationHtml(options.title, details);
      const payload: Record<string, any> = {
        to: recipient, from, subject: `${appName}: ${options.subject}`,
        text: `${options.title}\n\n${details.join('\n')}`,
      };
      if (html) {
        payload.html = html;
      }
      await this.emailGetter().send(payload);
    } catch {}
  }

  /**
   * Render the security-notification email body from its Handlebars template file.
   * Fail-safe: returns an empty string when the template cannot be read/compiled,
   * so the caller falls back to a text-only email instead of crashing.
   */
  async renderSecurityNotificationHtml(title: string, details: string[]): Promise<string> {
    try {
      const templatePath = path.join(__dirname, 'templates', 'security-notification.html');
      const templateSource = await fs.readFile(templatePath, 'utf-8');
      return Handlebars.compile(templateSource)({ title, details }).trim();
    } catch {
      return '';
    }
  }

  async resolveFrameworkAppName(): Promise<string> {
    const platformName = await this.getMetaValue(SystemConstants.META_KEY.PLATFORM_NAME);
    if (platformName) {
      return platformName;
    }

    const siteName = await this.getMetaValue(SystemConstants.META_KEY.SITE_NAME);
    if (siteName) {
      return siteName;
    }

    return String(process.env.APP_NAME || '').trim() || 'Platform';
  }

  /** The configured sender. Was a second copy of the invented `no-reply@<domain>` builder. */
  async resolveFrameworkSender(): Promise<FrameworkEmailSender> {
    return FrameworkEmailSenderService.resolve(this.integrations, await this.resolveFrameworkAppName());
  }

  async resolveFrameworkPlatformDomain(): Promise<string> {
    const configuredPlatformDomain = await this.getMetaValue(SystemConstants.META_KEY.PLATFORM_DOMAIN);
    if (configuredPlatformDomain) {
      return configuredPlatformDomain.toLowerCase();
    }

    return ApplicationUrlUtils.derivePlatformDomain(
      await this.getMetaValue(SystemConstants.META_KEY.SITE_URL),
      await this.getMetaValue(SystemConstants.META_KEY.FRONTEND_URL),
      await this.getMetaValue(SystemConstants.META_KEY.ADMIN_URL),
      ApplicationUrlUtils.readAppBaseUrlFromEnvironment(ApplicationUrlUtils.FRONTEND_APP),
      ApplicationUrlUtils.readAppBaseUrlFromEnvironment(ApplicationUrlUtils.ADMIN_APP),
      ApplicationUrlUtils.readAppBaseUrlFromEnvironment(ApplicationUrlUtils.API_APP),
    );
  }

  async getMetaValue(key: string): Promise<string> {
    const row = await this.db.findOne(SystemConstants.TABLE.META, { key });
    return String(row?.value || '').trim();
  }
}

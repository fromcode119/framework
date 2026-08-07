/** Plugin telemetry service — email alerting and digest. Extracted from PluginManager (ARC-007). */

import { SystemConstants } from '@core/constants/system.constants';
import { ApplicationUrlUtils } from '@core/application-url-utils';
import { IDatabaseManager } from '@fromcode119/database';
import { PluginEmailTemplateFileService } from '@core/plugin/services/plugin-email-template-file-service';
import { createHash } from 'crypto';

export class PluginTelemetryService {
  constructor(
    private readonly db: IDatabaseManager,
    private readonly emailGetter: () => { send: (opts: any) => Promise<any> },
  ) {}

  // --- Checks ---

  async isEmailTelemetryEnabled(): Promise<boolean> {
    try {
      const row = await this.db.findOne(SystemConstants.TABLE.META, { key: 'email_notifications' });
      const raw = String(row?.value || '').trim().toLowerCase();
      if (!raw) return true;
      return raw === 'true' || raw === '1' || raw === 'yes' || raw === 'on';
    } catch {
      return true;
    }
  }

  // --- Meta helpers ---

  async getMetaValue(key: string): Promise<string> {
    try {
      const row = await this.db.findOne(SystemConstants.TABLE.META, { key });
      return String(row?.value || '').trim();
    } catch { return ''; }
  }

  async upsertMetaValue(key: string, value: string): Promise<void> {
    try {
      const existing = await this.db.findOne(SystemConstants.TABLE.META, { key });
      if (existing) { await this.db.update(SystemConstants.TABLE.META, { key }, { value }); }
      else { await this.db.insert(SystemConstants.TABLE.META, { key, value }); }
    } catch { /* best-effort */ }
  }

  // --- Recipient helpers ---

  private normalizeEmailAddress(value: any): string {
    return String(value || '').trim().toLowerCase();
  }

  private parseRoles(value: any): string[] {
    if (Array.isArray(value)) return value.map((i) => String(i || '').trim().toLowerCase()).filter(Boolean);
    if (typeof value === 'string') {
      const raw = value.trim();
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.map((i) => String(i || '').trim().toLowerCase()).filter(Boolean);
      } catch {}
      return raw.split(',').map((i) => i.trim().toLowerCase()).filter(Boolean);
    }
    return [];
  }

  async getEmailTelemetryRecipients(): Promise<string[]> {
    const recipients = new Set<string>();
    const configuredRecipients = [
      await this.getMetaValue(SystemConstants.META_KEY.NOTIFICATION_EMAIL),
      await this.getMetaValue(SystemConstants.META_KEY.NOTIFICATION_EMAIL_CC),
    ]
      .flatMap((value) => String(value || '').split(/[,;\n]/))
      .map((item) => this.normalizeEmailAddress(item))
      .filter(Boolean);
    for (const recipient of configuredRecipients) {
      recipients.add(recipient);
    }
    if (recipients.size > 0) {
      return Array.from(recipients);
    }

    try {
      const users = await this.db.find(SystemConstants.TABLE.USERS, {
        columns: { email: true, roles: true },
        limit: 2000,
      });
      for (const user of users || []) {
        const email = this.normalizeEmailAddress(user?.email);
        if (!email) continue;
        if (this.parseRoles(user?.roles).includes('admin')) recipients.add(email);
      }
    } catch { /* ignore */ }
    return Array.from(recipients);
  }

  isCriticalLevel(level: string): boolean {
    const upper = String(level || '').trim().toUpperCase();
    return upper === 'ERROR' || upper === 'FATAL' || upper === 'CRITICAL' || upper === 'ALERT';
  }

  /**
   * Resolve the platform display name for email subjects/bodies: the configured
   * `platform_name` setting, then `site_name`, then the APP_NAME env var, then a
   * generic 'Platform' — never a hardcoded brand.
   */
  private async resolveAppName(): Promise<string> {
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

  private resolveSenderAddress(): string {
    const configuredSender = String(process.env.EMAIL_FROM || process.env.SMTP_FROM || '').trim();
    if (configuredSender) {
      return configuredSender;
    }

    const platformDomain = ApplicationUrlUtils.derivePlatformDomain(
      ApplicationUrlUtils.readAppBaseUrlFromEnvironment(ApplicationUrlUtils.FRONTEND_APP),
      ApplicationUrlUtils.readAppBaseUrlFromEnvironment(ApplicationUrlUtils.ADMIN_APP),
      ApplicationUrlUtils.readAppBaseUrlFromEnvironment(ApplicationUrlUtils.API_APP),
    );

    return `no-reply@${platformDomain || 'localhost'}`;
  }

  // --- Notification methods ---

  async notifyOnCriticalLog(level: string, message: string, pluginSlug?: string, context?: any): Promise<void> {
    if (!this.isCriticalLevel(level)) return;
    if (!(await this.isEmailTelemetryEnabled())) return;
    const recipients = await this.getEmailTelemetryRecipients();
    if (!recipients.length) return;

    const signature = createHash('sha256')
      .update(`${String(level || '')}|${String(pluginSlug || '')}|${String(message || '')}`)
      .digest('hex').slice(0, 24);
    const dedupeKey = `email_notifications:critical:${signature}`;
    const previousIso = await this.getMetaValue(dedupeKey);
    const previousAt = previousIso ? new Date(previousIso).getTime() : 0;
    const now = Date.now();
    if (previousAt && now - previousAt < 10 * 60 * 1000) return;
    await this.upsertMetaValue(dedupeKey, new Date(now).toISOString());

    const headline = String(message || '').trim() || 'Critical system log entry';
    const email = PluginEmailTemplateFileService.renderEmail('plugin-telemetry-critical', {
      appName: await this.resolveAppName(),
      pluginLabel: String(pluginSlug || 'system').trim() || 'system',
      level: String(level || '').toUpperCase(),
      timestamp: new Date(now).toISOString(),
      headline,
      shortHeadline: headline.length > 140 ? `${headline.slice(0, 137)}...` : headline,
      contextText: context ? JSON.stringify(context, null, 2) : '(none)',
    });

    await this.emailGetter().send({
      to: recipients.join(','),
      from: this.resolveSenderAddress(),
      subject: email.subject,
      text: email.text,
      html: email.html,
    });
  }

  async sendWeeklyEmailTelemetryDigest(): Promise<void> {
    if (!(await this.isEmailTelemetryEnabled())) return;
    const recipients = await this.getEmailTelemetryRecipients();
    if (!recipients.length) return;

    const now = Date.now();
    const weekAgo = now - (7 * 24 * 60 * 60 * 1000);
    const rows = await (this.db as any).find(SystemConstants.TABLE.LOGS, { orderBy: 'timestamp DESC', limit: 2000 }).catch(() => []);
    const recent = (rows || []).filter((row: any) => {
      const ts = new Date(row?.timestamp || 0).getTime();
      return Number.isFinite(ts) && ts >= weekAgo;
    });

    const levelCounts: Record<string, number> = { ERROR: 0, WARN: 0, INFO: 0, DEBUG: 0 };
    const pluginCounts: Record<string, number> = {};
    for (const row of recent) {
      const lvl = String(row?.level || '').toUpperCase();
      levelCounts[lvl] = (levelCounts[lvl] || 0) + 1;
      const plugin = String(row?.plugin_slug || row?.pluginSlug || 'system').trim() || 'system';
      pluginCounts[plugin] = (pluginCounts[plugin] || 0) + 1;
    }

    const email = PluginEmailTemplateFileService.renderEmail('plugin-telemetry-digest', {
      appName: await this.resolveAppName(),
      fromIso: new Date(weekAgo).toISOString(),
      toIso: new Date(now).toISOString(),
      totalEntries: recent.length,
      levels: {
        error: levelCounts.ERROR || 0,
        warn: levelCounts.WARN || 0,
        info: levelCounts.INFO || 0,
        debug: levelCounts.DEBUG || 0,
      },
      topPlugins: Object.entries(pluginCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([slug, count]) => ({ slug, count })),
      criticalEntries: recent
        .filter((row: any) => this.isCriticalLevel(String(row?.level || '')))
        .slice(0, 8)
        .map((row: any) => ({
          timestamp: String(row?.timestamp || ''),
          pluginSlug: String(row?.plugin_slug || 'system'),
          level: String(row?.level || ''),
          message: String(row?.message || ''),
        })),
    });

    await this.emailGetter().send({
      to: recipients.join(','),
      from: this.resolveSenderAddress(),
      subject: email.subject,
      text: email.text,
      html: email.html,
    });
  }

  async sendTestEmailTelemetry(triggeredBy?: { id?: string | number; email?: string; roles?: string[] }): Promise<{ sent: boolean; recipientsCount: number }> {
    if (!(await this.isEmailTelemetryEnabled())) throw new Error('Email telemetry is disabled. Enable it in Settings > General first.');
    const recipients = await this.getEmailTelemetryRecipients();
    if (!recipients.length) {
      throw new Error('No telemetry recipients are configured. Set Notification Email in Settings > General or ensure at least one admin user exists.');
    }

    const actorRoles = Array.isArray(triggeredBy?.roles) ? triggeredBy.roles.join(', ') : '';
    const email = PluginEmailTemplateFileService.renderEmail('plugin-telemetry-test', {
      appName: await this.resolveAppName(),
      nowIso: new Date().toISOString(),
      actorId: String(triggeredBy?.id || '').trim() || 'unknown',
      actorEmail: this.normalizeEmailAddress(triggeredBy?.email) || 'unknown',
      actorRoles: actorRoles || '(none)',
    });

    await this.emailGetter().send({
      to: recipients.join(','),
      from: this.resolveSenderAddress(),
      subject: email.subject,
      text: email.text,
      html: email.html,
    });
    return { sent: true, recipientsCount: recipients.length };
  }
}

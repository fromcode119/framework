/** Plugin telemetry service — email alerting and digest. Extracted from PluginManager (ARC-007). */

import { SystemConstants } from '@fromcode119/sdk';
import { IDatabaseManager } from '@fromcode119/database';
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
    const envRaw = process.env.EMAIL_ALERT_TO || process.env.ALERT_EMAIL_TO || process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || '';
    if (envRaw) {
      for (const item of String(envRaw).split(',')) {
        const n = this.normalizeEmailAddress(item);
        if (n) recipients.add(n);
      }
    }
    try {
      const users = await this.db.find('users', { columns: { email: true, roles: true }, limit: 2000 });
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

    const appName = process.env.APP_NAME || 'Fromcode';
    const from = process.env.EMAIL_FROM || process.env.SMTP_FROM || 'no-reply@framework.local';
    const pluginLabel = String(pluginSlug || 'system').trim() || 'system';
    const headline = String(message || '').trim() || 'Critical system log entry';
    const shortHeadline = headline.length > 140 ? `${headline.slice(0, 137)}...` : headline;
    const contextText = context ? JSON.stringify(context, null, 2) : '(none)';
    const timestamp = new Date(now).toISOString();

    await this.emailGetter().send({
      to: recipients.join(','), from,
      subject: `${appName}: Critical Alert [${pluginLabel}]`,
      text: `A critical log event was captured.\n\nTime (UTC): ${timestamp}\nLevel: ${String(level || '').toUpperCase()}\nPlugin: ${pluginLabel}\nMessage: ${headline}\n\nContext:\n${contextText}\n`,
      html: `<p><strong>A critical log event was captured.</strong></p><ul><li><strong>Time (UTC):</strong> ${timestamp}</li><li><strong>Level:</strong> ${String(level || '').toUpperCase()}</li><li><strong>Plugin:</strong> ${pluginLabel}</li><li><strong>Message:</strong> ${shortHeadline}</li></ul><p><strong>Context</strong></p><pre style="white-space:pre-wrap;background:#0b1020;color:#e2e8f0;padding:12px;border-radius:8px;">${contextText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`,
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

    const topPlugins = Object.entries(pluginCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const criticalRows = recent.filter((row: any) => this.isCriticalLevel(String(row?.level || ''))).slice(0, 8);
    const appName = process.env.APP_NAME || 'Fromcode';
    const from = process.env.EMAIL_FROM || process.env.SMTP_FROM || 'no-reply@framework.local';
    const fromIso = new Date(weekAgo).toISOString();
    const toIso = new Date(now).toISOString();

    const topPluginsText = topPlugins.length ? topPlugins.map(([s, c]) => `- ${s}: ${c}`).join('\n') : '- (no activity)';
    const criticalText = criticalRows.length ? criticalRows.map((row: any) => `- [${String(row?.timestamp || '')}] ${String(row?.plugin_slug || 'system')} ${String(row?.level || '')}: ${String(row?.message || '')}`).join('\n') : '- (none)';
    const htmlPlugins = topPlugins.length ? `<ul>${topPlugins.map(([s, c]) => `<li><strong>${s}</strong>: ${c}</li>`).join('')}</ul>` : `<p>(no activity)</p>`;
    const htmlCritical = criticalRows.length ? `<ul>${criticalRows.map((row: any) => `<li><strong>${String(row?.timestamp || '')}</strong> [${String(row?.plugin_slug || 'system')}] ${String(row?.level || '')}: ${String(row?.message || '')}</li>`).join('')}</ul>` : `<p>(none)</p>`;

    await this.emailGetter().send({
      to: recipients.join(','), from,
      subject: `${appName}: Weekly System Summary`,
      text: `System telemetry summary for ${fromIso} -> ${toIso}\n\nTotal log entries: ${recent.length}\nLevels:\n- ERROR: ${levelCounts.ERROR || 0}\n- WARN: ${levelCounts.WARN || 0}\n- INFO: ${levelCounts.INFO || 0}\n- DEBUG: ${levelCounts.DEBUG || 0}\n\nTop active plugins:\n${topPluginsText}\n\nRecent critical entries:\n${criticalText}\n`,
      html: `<p><strong>System telemetry summary</strong></p><p>Window: ${fromIso} -> ${toIso}</p><p>Total log entries: <strong>${recent.length}</strong></p><ul><li>ERROR: <strong>${levelCounts.ERROR || 0}</strong></li><li>WARN: <strong>${levelCounts.WARN || 0}</strong></li><li>INFO: <strong>${levelCounts.INFO || 0}</strong></li><li>DEBUG: <strong>${levelCounts.DEBUG || 0}</strong></li></ul><p><strong>Top active plugins</strong></p>${htmlPlugins}<p><strong>Recent critical entries</strong></p>${htmlCritical}`,
    });
  }

  async sendTestEmailTelemetry(triggeredBy?: { id?: string | number; email?: string; roles?: string[] }): Promise<{ sent: boolean; recipientsCount: number }> {
    if (!(await this.isEmailTelemetryEnabled())) throw new Error('Email telemetry is disabled. Enable it in Settings > General first.');
    const recipients = await this.getEmailTelemetryRecipients();
    if (!recipients.length) throw new Error('No telemetry recipients are configured.');

    const nowIso = new Date().toISOString();
    const appName = process.env.APP_NAME || 'Fromcode';
    const from = process.env.EMAIL_FROM || process.env.SMTP_FROM || 'no-reply@framework.local';
    const actorEmail = this.normalizeEmailAddress(triggeredBy?.email) || 'unknown';
    const actorId = String(triggeredBy?.id || '').trim() || 'unknown';
    const actorRoles = Array.isArray(triggeredBy?.roles) ? triggeredBy.roles.join(', ') : '';

    await this.emailGetter().send({
      to: recipients.join(','), from,
      subject: `${appName}: Telemetry Test Email`,
      text: `This is a test telemetry email from ${appName}.\n\nTime (UTC): ${nowIso}\nTriggered by user id: ${actorId}\nTriggered by email: ${actorEmail}\nRoles: ${actorRoles || '(none)'}\n\nIf you received this message, your configured Email integration is working for telemetry delivery.\n`,
      html: `<p><strong>This is a test telemetry email from ${appName}.</strong></p><ul><li><strong>Time (UTC):</strong> ${nowIso}</li><li><strong>Triggered by user id:</strong> ${actorId}</li><li><strong>Triggered by email:</strong> ${actorEmail}</li><li><strong>Roles:</strong> ${actorRoles || '(none)'}</li></ul><p>If you received this message, your configured Email integration is working for telemetry delivery.</p>`,
    });
    return { sent: true, recipientsCount: recipients.length };
  }
}

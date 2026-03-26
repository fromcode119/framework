/** ServerSettingsService — settings cache management. Extracted from APIServer (ARC-007). */

import { Logger } from '@fromcode119/core';
import { SystemConstants } from '@fromcode119/core';
import { CacheManager } from '@fromcode119/cache';

export class ServerSettingsService {
  private settingsInterval?: NodeJS.Timeout;

  constructor(
    private readonly db: any,
    private readonly cache: CacheManager,
    private readonly settingsCache: Map<string, string>,
    private readonly logger: Logger,
  ) {}

  async setupSettingsSync() {
    await this.refreshSettingsCache();
    const interval = process.env.NODE_ENV === 'development' ? 10 * 1000 : 5 * 60 * 1000;
    this.settingsInterval = setInterval(() => {
      this.refreshSettingsCache().catch((err) => this.logger.error('Background cache sync failed: ' + err));
    }, interval);
  }

  stopSettingsSync() {
    if (this.settingsInterval) {
      clearInterval(this.settingsInterval);
      this.settingsInterval = undefined;
    }
  }

  async refreshSettingsCache() {
    try {
      const hasMetaTable = await this.db.tableExists(SystemConstants.TABLE.META);
      if (!hasMetaTable) {
        this.logger.warn(`System meta table "${SystemConstants.TABLE.META}" not found. Skipping settings sync.`);
        return;
      }
      const rows = await this.db.find(SystemConstants.TABLE.META, { columns: { key: true, value: true, description: true, group: true } });
      if (rows && rows.length > 0) {
        this.logger.debug(`Synced ${rows.length} settings from DB.`);
      }
      if (Array.isArray(rows)) {
        for (const row of rows) {
          if (row && row.key) {
            this.settingsCache.set(row.key, row.value);
            await this.cache.set(`system_setting:${row.key}`, row.value);
          }
        }
      }
      await this.ensureDefaultSettings();
    } catch (err) {
      this.logger.error('Failed to sync settings cache: ' + err);
    }
  }

  async ensureDefaultSettings() {
    try {
      const hasMetaTable = await this.db.tableExists(SystemConstants.TABLE.META);
      if (!hasMetaTable) return;

      const defaults = [
        { key: SystemConstants.META_KEY.PLATFORM_NAME, value: 'Fromcode Core', description: 'The identity of your platform instance.', group: 'General' },
        { key: SystemConstants.META_KEY.SITE_NAME, value: 'Fromcode', description: 'Public site name used in emails and frontend.', group: 'General' },
        { key: SystemConstants.META_KEY.SITE_URL, value: 'http://frontend.framework.local', description: 'Base URL for the public site.', group: 'General' },
        { key: SystemConstants.META_KEY.FRONTEND_URL, value: 'http://frontend.framework.local', description: 'The primary URL for your frontend application.', group: 'General' },
        { key: SystemConstants.META_KEY.ADMIN_URL, value: 'http://admin.framework.local', description: 'The primary URL for your admin dashboard.', group: 'General' },
        { key: SystemConstants.META_KEY.PLATFORM_DOMAIN, value: 'framework.local', description: 'Root domain for the entire platform setup.', group: 'General' },
        { key: SystemConstants.META_KEY.TIMEZONE, value: 'UTC', description: 'Default system timezone.', group: 'General' },
        { key: SystemConstants.META_KEY.ROUTING_HOME_TARGET, value: 'auto', description: 'Homepage route target.', group: 'Routing' },
        { key: SystemConstants.META_KEY.PERMALINK_STRUCTURE, value: '/:slug', description: 'Default URL structure for content.', group: 'General' },
        { key: SystemConstants.META_KEY.MAINTENANCE_MODE, value: 'false', description: 'Enable global maintenance mode.', group: 'Settings' },
        { key: SystemConstants.META_KEY.RATE_LIMIT_MAX, value: '100', description: 'Maximum requests per window per IP.', group: 'security' },
        { key: SystemConstants.META_KEY.RATE_LIMIT_WINDOW, value: '900000', description: 'Rate limit window in milliseconds.', group: 'security' },
        { key: SystemConstants.META_KEY.AUTH_SESSION_DURATION, value: '10080', description: 'Login session duration in minutes.', group: 'security' },
        { key: SystemConstants.META_KEY.AUTH_PASSWORD_MIN_LENGTH, value: '8', description: 'Minimum required password length.', group: 'security' },
        { key: SystemConstants.META_KEY.AUTH_PASSWORD_REQUIRE_UPPERCASE, value: 'true', description: 'Require uppercase letters.', group: 'security' },
        { key: SystemConstants.META_KEY.AUTH_PASSWORD_REQUIRE_LOWERCASE, value: 'true', description: 'Require lowercase letters.', group: 'security' },
        { key: SystemConstants.META_KEY.AUTH_PASSWORD_REQUIRE_NUMBER, value: 'true', description: 'Require digits.', group: 'security' },
        { key: SystemConstants.META_KEY.AUTH_PASSWORD_REQUIRE_SYMBOL, value: 'false', description: 'Require symbols.', group: 'security' },
        { key: SystemConstants.META_KEY.AUTH_PASSWORD_HISTORY, value: '5', description: 'Prevent reuse of the last N passwords.', group: 'security' },
        { key: SystemConstants.META_KEY.AUTH_PASSWORD_BREACH_CHECK, value: 'false', description: 'Enable breach-check hook.', group: 'security' },
        { key: SystemConstants.META_KEY.AUTH_PASSWORD_RESET_TOKEN_MINUTES, value: '30', description: 'Password reset token lifetime in minutes.', group: 'security' },
        { key: SystemConstants.META_KEY.AUTH_EMAIL_CHANGE_TOKEN_MINUTES, value: '60', description: 'Email change token lifetime in minutes.', group: 'security' },
        { key: SystemConstants.META_KEY.AUTH_LOCKOUT_THRESHOLD, value: '5', description: 'Failed logins before lockout.', group: 'security' },
        { key: SystemConstants.META_KEY.AUTH_LOCKOUT_WINDOW_MINUTES, value: '15', description: 'Window for counting failed logins.', group: 'security' },
        { key: SystemConstants.META_KEY.AUTH_LOCKOUT_DURATION_MINUTES, value: '30', description: 'Lockout duration in minutes.', group: 'security' },
        { key: SystemConstants.META_KEY.AUTH_CAPTCHA_ENABLED, value: 'false', description: 'Require captcha after repeated failures.', group: 'security' },
        { key: SystemConstants.META_KEY.AUTH_CAPTCHA_THRESHOLD, value: '3', description: 'Failed attempts before captcha is required.', group: 'security' },
        { key: SystemConstants.META_KEY.AUTH_SECURITY_NOTIFICATIONS, value: 'true', description: 'Send security notification emails.', group: 'security' },
        { key: SystemConstants.META_KEY.TWO_FACTOR_ENABLED, value: 'false', description: 'Enable two-factor authentication.', group: 'security' },
        { key: SystemConstants.META_KEY.LOCALIZATION_LOCALES, value: '[{"code":"en","name":"English","enabled":true}]', description: 'Available locales.', group: 'Localization' },
        { key: SystemConstants.META_KEY.ENABLED_LOCALES, value: 'en', description: 'Enabled locale codes.', group: 'Localization' },
        { key: SystemConstants.META_KEY.DEFAULT_LOCALE, value: 'en', description: 'Default locale.', group: 'Localization' },
        { key: SystemConstants.META_KEY.ADMIN_DEFAULT_LOCALE, value: 'en', description: 'Default admin language.', group: 'Localization' },
        { key: SystemConstants.META_KEY.FRONTEND_DEFAULT_LOCALE, value: 'en', description: 'Default frontend language.', group: 'Localization' },
        { key: SystemConstants.META_KEY.LOCALE_URL_STRATEGY, value: 'query', description: 'Locale URL strategy.', group: 'Localization' },
        { key: SystemConstants.META_KEY.FRONTEND_AUTH_ENABLED, value: 'true', description: 'Enable frontend auth flows.', group: 'security' },
        { key: SystemConstants.META_KEY.FRONTEND_REGISTRATION_ENABLED, value: 'true', description: 'Allow new customer self-registration.', group: 'security' },
        { key: SystemConstants.META_KEY.EMAIL_NOTIFICATIONS, value: 'true', description: 'Receive system alerts via email.', group: 'Engagement' },
      ];

      for (const d of defaults) {
        const existing = await this.db.findOne(SystemConstants.TABLE.META, { key: d.key });
        if (!existing) {
          await this.db.insert(SystemConstants.TABLE.META, d);
          this.settingsCache.set(d.key, d.value);
          await this.cache.set(`system_setting:${d.key}`, d.value);
        } else {
          if (existing.key) { this.settingsCache.set(existing.key, existing.value); await this.cache.set(`system_setting:${existing.key}`, existing.value); }
          const shouldReplaceLocalhost =
            (d.key === SystemConstants.META_KEY.SITE_URL ||
              d.key === SystemConstants.META_KEY.FRONTEND_URL ||
              d.key === SystemConstants.META_KEY.ADMIN_URL) &&
            String(existing.value || '').trim().startsWith('http://localhost:');
          if (shouldReplaceLocalhost && existing.value !== d.value) {
            await this.db.update(SystemConstants.TABLE.META, { key: d.key }, { value: d.value, description: d.description, group: d.group });
            this.settingsCache.set(d.key, d.value);
            await this.cache.set(`system_setting:${d.key}`, d.value);
            continue;
          }
          if (existing.description !== d.description || existing.group !== d.group) {
            await this.db.update(SystemConstants.TABLE.META, { key: d.key }, { description: d.description, group: d.group });
          }
        }
      }
    } catch (e) {
      this.logger.error('Failed to ensure default settings: ' + e);
    }
  }
}

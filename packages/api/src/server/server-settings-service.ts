/** ServerSettingsService — settings cache management. Extracted from APIServer (ARC-007). */

import { ApplicationUrlUtils, Logger } from '@fromcode119/core';
import { SystemConstants } from '@fromcode119/core';
import { CacheManager } from '@fromcode119/cache';
import { RateLimitSettingsUtils } from '@api/utils/rate-limit-settings-utils';
import { SystemSettingRegistry } from '@fromcode119/core';

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

  /**
   * Re-read the settings the moment an admin saves one, instead of after the next poll.
   *
   * Everything that reads through this cache -- the rate limiter's budgets and its internal-client
   * allowlist, CORS, the maintenance gate -- was answering with the PREVIOUS value for up to five
   * minutes in production. The operator saw the new number read back on the screen while the platform
   * went on enforcing the old one, which is indistinguishable from a control that does nothing. The
   * settings controller already announces every change; this listens.
   */
  subscribeToSettingsChanges(hooks: { on: (event: string, handler: (payload: unknown) => void) => void }) {
    hooks.on('system:settings:updated', () => {
      this.refreshSettingsCache().catch((err) => this.logger.error('Settings cache refresh after update failed: ' + err));
    });
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

      // DECLARED, not listed here. A setting's default, description and group now live beside its
      // scope and writability in `SystemSettingRegistry`, so a setting is declared in one place
      // instead of being half here and half in core. The app URLs among them are only knowable at
      // boot, so the registry holds those as thunks and resolves them now.
      const defaults = SystemSettingRegistry.seedDefaults();

      for (const d of defaults) {
        const existing = await this.db.findOne(SystemConstants.TABLE.META, { key: d.key });
        if (!existing) {
          await this.db.insert(SystemConstants.TABLE.META, d);
          this.settingsCache.set(d.key, d.value);
          await this.cache.set(`system_setting:${d.key}`, d.value);
        } else {
          // A SAVED value is the operator's, full stop. This branch used to overwrite site_url /
          // frontend_url / admin_url / platform_domain with the env-derived value whenever the saved one
          // matched a literal-text "legacy" test (the `framework.local` domain, plus ANY http loopback
          // URL) — on every cache refresh, i.e. every 10s in dev and every 5min in production. An
          // operator could set http://localhost:3002 in the admin, save, and find it silently reverted.
          // Defaults now apply on FIRST INSERT only; only the description/group metadata is reconciled.
          if (existing.key) { this.settingsCache.set(existing.key, existing.value); await this.cache.set(`system_setting:${existing.key}`, existing.value); }
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

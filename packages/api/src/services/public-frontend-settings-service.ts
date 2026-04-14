import { SystemConstants } from '@fromcode119/core';
import { IDatabaseManager } from '@fromcode119/database';

export class PublicFrontendSettingsService {
  private static readonly PUBLIC_KEYS = new Set<string>([
    SystemConstants.META_KEY.LOCALE_URL_STRATEGY,
    SystemConstants.META_KEY.ENABLED_LOCALES,
    SystemConstants.META_KEY.LOCALIZATION_LOCALES,
    SystemConstants.META_KEY.ROUTING_HOME_TARGET,
    SystemConstants.META_KEY.FRONTEND_AUTH_ENABLED,
    SystemConstants.META_KEY.FRONTEND_REGISTRATION_ENABLED,
  ]);

  async getSettings(db: IDatabaseManager): Promise<Record<string, string>> {
    const rows = await db.find(SystemConstants.TABLE.META);
    const settings: Record<string, string> = {};

    for (const row of Array.isArray(rows) ? rows : []) {
      const key = String((row as any)?.key || '').trim();
      if (!PublicFrontendSettingsService.PUBLIC_KEYS.has(key)) {
        continue;
      }

      settings[key] = String((row as any)?.value ?? '').trim();
    }

    return settings;
  }
}
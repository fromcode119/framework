import { cache } from 'react';

import { FrontendConfigCache } from '@/lib/frontend-config-cache';

export class FrontendPublicSettings {
  /**
   * Strict on purpose: these settings decide the locale URL strategy and the home target, i.e.
   * how a URL is parsed into a slug. Silently substituting defaults because the API was
   * unreachable makes the router mis-resolve a real page and 404 it — so an unreachable API
   * throws here and the request becomes an honest 5xx.
   */
  private static readonly settingsMapCache = cache(async (): Promise<Map<string, string>> => {
    const result = (await FrontendConfigCache.readOutcome()).valueOrThrow('/system/frontend');
    const rawSettings = result?.publicSettings as Record<string, unknown> | undefined;
    const map = new Map<string, string>();

    for (const [key, value] of Object.entries(rawSettings || {})) {
      const normalizedKey = String(key || '').trim();
      if (!normalizedKey) {
        continue;
      }

      map.set(normalizedKey, String(value ?? '').trim());
    }

    return map;
  });

  static async readSettingValue(key: string): Promise<string> {
    const map = await FrontendPublicSettings.settingsMapCache();
    return String(map.get(key) || '').trim();
  }
}

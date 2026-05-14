import { cache } from 'react';
import { ServerApiUtils } from './server-api';

export class FrontendPublicSettings {
  private static readonly settingsMapCache = cache(async (): Promise<Map<string, string>> => {
    const internalResponse = await ServerApiUtils.serverFetchInternalResponse(ServerApiUtils.buildSystemFrontendPath());
    const result = internalResponse?.ok
      ? await internalResponse.json() as Record<string, unknown>
      : await ServerApiUtils.serverFetchJson(ServerApiUtils.buildSystemFrontendPath()) as Record<string, unknown> | null;
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

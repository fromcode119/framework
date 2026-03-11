import { cache } from 'react';
import { ServerApiUtils } from './server-api';

export class FrontendAuthUtils {
  static async isFrontendAuthEnabled(): Promise<boolean> {
    const raw = await FrontendAuthUtils.readSettingValue('frontend_auth_enabled');
    return FrontendAuthUtils.parseBoolean(raw, true);
  }

  static async isFrontendRegistrationEnabled(): Promise<boolean> {
    const raw = await FrontendAuthUtils.readSettingValue('frontend_registration_enabled');
    return FrontendAuthUtils.parseBoolean(raw, true);
  }

  // ---------------------------------------------------------------------------
  // Private static helpers (implementation details — not part of public API)
  // ---------------------------------------------------------------------------

  private static parseBoolean(value: any, fallback: boolean): boolean {
    if (value === undefined || value === null || value === '') return fallback;
    const normalized = String(value).trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
    return fallback;
  }

  // React cache is kept at module level (required by Next.js caching semantics)
  // but wrapped as a private static accessor to keep the public API clean.
  private static readonly settingsMapCache = cache(async () => {
    const result = await ServerApiUtils.serverFetchJson(ServerApiUtils.buildSettingsCollectionPath(500)) as Record<string, any>;
    const docs = Array.isArray(result?.docs)
      ? result.docs
      : Array.isArray(result)
        ? result
        : [];

    const map = new Map<string, string>();
    for (const doc of docs) {
      const key = String(doc?.key || '').trim();
      if (!key) continue;
      map.set(key, String(doc?.value ?? '').trim());
    }
    return map;
  });

  private static async readSettingValue(key: string): Promise<string> {
    const map = await FrontendAuthUtils.settingsMapCache();
    return String(map.get(key) || '').trim();
  }
}
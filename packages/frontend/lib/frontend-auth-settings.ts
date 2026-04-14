import { FrontendPublicSettings } from './frontend-public-settings';

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

  private static async readSettingValue(key: string): Promise<string> {
    return FrontendPublicSettings.readSettingValue(key);
  }
}
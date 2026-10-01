import { RequestContextUtils, SystemConstants } from '@fromcode119/core';
import { IDatabaseManager } from '@fromcode119/database';

export class PublicFrontendSettingsService {
  private static readonly PUBLIC_KEYS = new Set<string>([
    SystemConstants.META_KEY.LOCALE_URL_STRATEGY,
    SystemConstants.META_KEY.ENABLED_LOCALES,
    SystemConstants.META_KEY.LOCALIZATION_LOCALES,
    SystemConstants.META_KEY.DEFAULT_LOCALE,
    SystemConstants.META_KEY.FALLBACK_LOCALE,
    SystemConstants.META_KEY.FRONTEND_DEFAULT_LOCALE,
    // The site country: storefront forms (a checkout address) default to it — see PlatformCountryUtils.
    SystemConstants.META_KEY.COUNTRY,
    SystemConstants.META_KEY.ROUTING_HOME_TARGET,
    SystemConstants.META_KEY.FRONTEND_AUTH_ENABLED,
    SystemConstants.META_KEY.FRONTEND_REGISTRATION_ENABLED,
    SystemConstants.META_KEY.CONTACT_DETAIL_PROTECTION,
  ]);

  /** Keys the api resolves site-first, then platform, when it acts on them (`AuthControllerSharedInfrastructure.readMetaRow`). */
  private static readonly INHERITED_KEYS = [
    SystemConstants.META_KEY.FRONTEND_AUTH_ENABLED,
    SystemConstants.META_KEY.FRONTEND_REGISTRATION_ENABLED,
  ];

  /**
   * The site's own row for each public key; for the sign-in switches, the platform's where the site has
   * none — the resolution the api applies when it answers those requests.
   * Reading the site's rows alone left a key the site never set out of this map, and the storefront
   * then assumed its own default: a site inheriting the platform's `frontend_auth_enabled = false`
   * still served sign-up and password pages whose every request the api answered "Not found".
   */
  async getSettings(db: IDatabaseManager): Promise<Record<string, string>> {
    const settings = PublicFrontendSettingsService.collect(await db.find(SystemConstants.TABLE.META));
    const inherited = PublicFrontendSettingsService.INHERITED_KEYS.filter((key) => !(key in settings));
    if (!RequestContextUtils.getTenantId() || inherited.length === 0) return settings;
    const platform = await db.withPlatformAdmin(async () => Promise.all(
      inherited.map((key) => db.findOne(SystemConstants.TABLE.META, { key })),
    ));
    return { ...PublicFrontendSettingsService.collect(platform.filter(Boolean)), ...settings };
  }

  private static collect(rows: unknown): Record<string, string> {
    const settings: Record<string, string> = {};
    for (const row of Array.isArray(rows) ? rows : []) {
      const key = String((row as any)?.key || '').trim();
      if (!PublicFrontendSettingsService.PUBLIC_KEYS.has(key)) continue;
      settings[key] = String((row as any)?.value ?? '').trim();
    }
    return settings;
  }
}

import { AdminSchemaLocalizer, SystemConstants, SystemSettingsExposureUtils } from '@fromcode119/core';
import type { PluginManager } from '@fromcode119/core';

/**
 * Binds `AdminSchemaLocalizer` to the console's language — Settings → Localization → "Admin default
 * locale" of the site the request is for — and to the plugins' dictionaries the api already holds.
 * No language configured means no translation: the schemas go out as declared.
 */
export class AdminSchemaLocalization {
  static async forRequest(manager: PluginManager): Promise<AdminSchemaLocalizer> {
    // `find`, not `findOne`: the key is INHERITED, so the site's row and the platform's can both be
    // visible and the site's own choice must win.
    const rows = await (manager as any).db.find(SystemConstants.TABLE.META, { where: { key: SystemConstants.META_KEY.ADMIN_DEFAULT_LOCALE } });
    const settings = SystemSettingsExposureUtils.toExposableSettingsMap(rows);
    return AdminSchemaLocalization.forLocale(manager, String(settings[SystemConstants.META_KEY.ADMIN_DEFAULT_LOCALE] ?? ''));
  }

  static forLocale(manager: PluginManager, locale: string): AdminSchemaLocalizer {
    const target = String(locale || '').trim().toLowerCase();
    return new AdminSchemaLocalizer((pluginSlug, key) => (target
      ? manager.i18n.translateOrFallback(`${pluginSlug}.${key}`, '', {}, target)
      : ''));
  }
}

import { AdminSchemaLocalizer, SystemConstants } from '@fromcode119/core';
import type { PluginManager } from '@fromcode119/core';

/**
 * Binds `AdminSchemaLocalizer` to the console's language — Settings → Localization → "Admin default
 * locale" of the site the request is for — and to the plugins' dictionaries the api already holds.
 * No language configured means no translation: the schemas go out as declared.
 */
export class AdminSchemaLocalization {
  static async forRequest(manager: PluginManager): Promise<AdminSchemaLocalizer> {
    const row = await (manager as any).db.findOne(SystemConstants.TABLE.META, { key: SystemConstants.META_KEY.ADMIN_DEFAULT_LOCALE });
    return AdminSchemaLocalization.forLocale(manager, String(row?.value ?? ''));
  }

  static forLocale(manager: PluginManager, locale: string): AdminSchemaLocalizer {
    const target = String(locale || '').trim().toLowerCase();
    return new AdminSchemaLocalizer((pluginSlug, key) => (target
      ? manager.i18n.translateOrFallback(`${pluginSlug}.${key}`, '', {}, target)
      : ''));
  }
}

import { AdminSchemaLocalizer } from '@fromcode119/core';
import type { PluginManager } from '@fromcode119/core';
import { AdminConsoleLocale } from '@api/services/system/admin-console-locale';

/**
 * Binds `AdminSchemaLocalizer` to the console's language for the person making the request
 * ({@link AdminConsoleLocale}) and to the plugins' dictionaries the api already holds.
 * No language resolved means no translation: the schemas go out as declared.
 */
export class AdminSchemaLocalization {
  /** For an authenticated admin request: the person's own language, else the site's default. */
  static async forRequest(manager: PluginManager, req?: object): Promise<AdminSchemaLocalizer> {
    return AdminSchemaLocalization.forLocale(manager, await AdminConsoleLocale.resolve(manager, req));
  }

  /**
   * For a payload shared between callers (edge-cached): the site's default only, never one person's
   * choice, or the next visitor would be served someone else's language.
   */
  static async forSite(manager: PluginManager): Promise<AdminSchemaLocalizer> {
    return AdminSchemaLocalization.forLocale(manager, await AdminConsoleLocale.siteDefault(manager));
  }

  static forLocale(manager: PluginManager, locale: string): AdminSchemaLocalizer {
    const target = String(locale || '').trim().toLowerCase();
    return new AdminSchemaLocalizer((pluginSlug, key) => (target
      ? manager.i18n.translateOrFallback(`${pluginSlug}.${key}`, '', {}, target)
      : ''));
  }
}

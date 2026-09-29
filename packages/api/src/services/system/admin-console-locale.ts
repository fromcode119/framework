import { SystemConstants, SystemSettingsExposureUtils } from '@fromcode119/core';
import type { PluginManager } from '@fromcode119/core';
import { PeopleSelfService } from '@api/services/people-self-service';

/**
 * The language the console speaks to the person making this request.
 *
 * Reading is personal, so the signed-in person's own choice wins — `people.preferred_locale`, the same
 * field their emails already follow, set from the account menu. A person who has not chosen gets the
 * site's Settings → Localization → "Admin default locale" (INHERITED: the site's row over the
 * platform's). No choice and no default means '' — the schemas go out as declared.
 */
export class AdminConsoleLocale {
  static async resolve(manager: PluginManager, req?: object): Promise<string> {
    return (await AdminConsoleLocale.personal(manager, req)) || AdminConsoleLocale.siteDefault(manager);
  }

  /** The person's own choice, '' when they have none or nobody is signed in. */
  static async personal(manager: PluginManager, req?: object): Promise<string> {
    const userId = (req as { user?: { id?: unknown } } | undefined)?.user?.id;
    if (userId == null || userId === '') return '';
    const row = await (manager as any).db.findOne(SystemConstants.TABLE.PEOPLE, { userId }).catch(() => null);
    return String(PeopleSelfService.toCamel(row)?.preferredLocale ?? '').trim().toLowerCase();
  }

  static async siteDefault(manager: PluginManager): Promise<string> {
    // `find`, not `findOne`: the key is INHERITED, so the site's row and the platform's can both be
    // visible and the site's own choice must win.
    const rows = await (manager as any).db.find(SystemConstants.TABLE.META, { where: { key: SystemConstants.META_KEY.ADMIN_DEFAULT_LOCALE } });
    const settings = SystemSettingsExposureUtils.toExposableSettingsMap(rows);
    return String(settings[SystemConstants.META_KEY.ADMIN_DEFAULT_LOCALE] ?? '').trim().toLowerCase();
  }
}

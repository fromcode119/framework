import { StringUtils } from '@fromcode119/core/client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * Navigation text in the console's language.
 *
 * A plugin's menu and panel entries arrive already translated from its own dictionary (the api does
 * that). The framework's own entries — Dashboard, Users, Settings and their sub-pages — are the
 * console's to translate: `nav.items.<path>` for a menu entry, `nav.panel.<id>` for a panel entry and
 * `nav.groups.<group>` for a heading. Anything without a key keeps the text it came with.
 */
export class AdminNavText {
  private static readonly SYSTEM = 'system';

  static menuLabel(item: { label?: string; path?: string; pluginSlug?: string }): string {
    const label = String(item?.label ?? '');
    if (item?.pluginSlug && item.pluginSlug !== AdminNavText.SYSTEM) return label;
    return AdminI18n.optional(`nav.items.${AdminNavText.pathKey(item?.path)}`) || label;
  }

  static panelLabel(item: { label?: string; id?: string; sourcePlugin?: string }): string {
    const label = String(item?.label ?? '');
    if (item?.sourcePlugin !== AdminNavText.SYSTEM) return label;
    return AdminI18n.optional(`nav.panel.${item.id}`) || label;
  }

  static group(name: string): string {
    const key = StringUtils.slugify(name, '');
    return (key && AdminI18n.optional(`nav.groups.${key}`)) || name;
  }

  /** `/` is the dashboard; `/settings/localization` is `settings-localization`. */
  private static pathKey(path?: string): string {
    const segments = String(path || '').split(/[?#]/)[0].split('/').filter(Boolean);
    return segments.length ? segments.join('-') : 'dashboard';
  }
}

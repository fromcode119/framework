import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * A catalog entry's words. The api translates a plugin's keys from that plugin's dictionary; the
 * platform's own emails are worded in the console's, so an empty value is looked up here by its key.
 */
export class EmailCatalogText {
  static label(entry: any): string {
    return String(entry?.label || '') || AdminI18n.optional(String(entry?.labelKey || '')) || String(entry?.key || '');
  }

  static trigger(entry: any): string {
    return String(entry?.trigger || '') || AdminI18n.optional(String(entry?.triggerKey || '')) || '';
  }
}

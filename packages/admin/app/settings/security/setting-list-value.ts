import { SettingListSeparator } from '@/app/settings/security/enums/setting-list-separator.enum';

/**
 * A list setting's stored text and its entries. The API's readers split on commas and new lines alike
 * (`EdgeProtectionReader`, `NetworkAddressUtils.parseList`, `DatabaseWriteAudit`); the console writes each
 * list back in the shape it already had, so a saved value reads the same to every reader.
 */
export class SettingListValue {
  static parse(stored: string): string[] {
    return String(stored ?? '').split(/\r?\n|,|;/).map((entry) => entry.trim()).filter(Boolean);
  }

  static join(entries: string[], separator: SettingListSeparator): string {
    return [...new Set(entries.map((entry) => entry.trim()).filter(Boolean))].join(String(separator.value));
  }
}

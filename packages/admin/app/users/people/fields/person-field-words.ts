import { AdminI18n } from '@/lib/i18n/admin-i18n';

/** The console reader's language first, then English, then the first language the operator filled. */
export class PersonFieldWords {
  static pick(words: Record<string, string> | undefined, fallback = ''): string {
    if (!words) return fallback;
    return words[AdminI18n.locale] || words.en || Object.values(words).find(Boolean) || fallback;
  }
}

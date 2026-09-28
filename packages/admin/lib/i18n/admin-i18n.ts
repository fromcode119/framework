import { AdminDictionary } from '@/lib/i18n/admin-dictionary';
import { Platform } from '@fromcode119/react-class-components';

/**
 * The language the console speaks, and its words.
 *
 * Settings → Localization → "Admin default locale" names the language; this holds it for the running
 * console and translates the console's own copy from its bundled dictionaries (`i18n/<locale>.json`).
 * Plugin screens translate through their own dictionaries; this is the chrome around them.
 *
 * The console used to set only `<html lang>` from that setting: every string was English in code, so
 * choosing Bulgarian changed nothing on screen.
 *
 * A change re-renders the whole console (`ClientLayout` keys its tree by the locale), so a component
 * reads `AdminI18n.t` directly in `render()` with no subscription of its own.
 */
export class AdminI18n {
  /** Remembers the last language between full page loads, so a reload does not start in English. */
  private static readonly STORAGE_KEY = 'fc_admin_locale';
  private static current = AdminDictionary.FALLBACK_LOCALE;
  private static readonly listeners = new Set<(locale: string) => void>();

  static get locale(): string {
    return AdminI18n.current;
  }

  /**
   * The console's word for `key`, with `{{name}}` placeholders filled from `vars`. A key the locale does
   * not have yet falls back to English, and one English lacks shows the key — never a blank.
   */
  static t(key: string, vars?: Record<string, unknown>): string {
    const text = AdminDictionary.translate(AdminI18n.current, key);
    if (!vars) return text;
    return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name: string) =>
      Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name] ?? '') : match);
  }

  /** The console's word for `key`, or '' when no dictionary has it — for text that may keep its own wording. */
  static optional(key: string): string {
    const text = AdminDictionary.translate(AdminI18n.current, key);
    return text === key ? '' : text;
  }

  static setLocale(locale: string): void {
    const next = String(locale || '').trim().toLowerCase() || AdminDictionary.FALLBACK_LOCALE;
    try {
      window.localStorage.setItem(AdminI18n.STORAGE_KEY, next);
    } catch {
      // Private window or blocked storage: the setting is re-read on the next load anyway.
    }
    if (next === AdminI18n.current) return;
    AdminI18n.current = next;
    if (Platform.isBrowser) document.documentElement.lang = next;
    for (const listener of Array.from(AdminI18n.listeners)) listener(next);
  }

  /** The language this browser last used, or '' when it has none (first visit, storage blocked). */
  static remembered(): string {
    try {
      return String(window.localStorage.getItem(AdminI18n.STORAGE_KEY) || '');
    } catch {
      return '';
    }
  }

  static subscribe(listener: (locale: string) => void): () => void {
    AdminI18n.listeners.add(listener);
    return () => AdminI18n.listeners.delete(listener);
  }
}

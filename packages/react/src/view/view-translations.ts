import { FrameworkTranslations } from '@react/i18n/framework-translations';
import EN from '@react/view/i18n/en.json';
import BG from '@react/view/i18n/bg.json';

/**
 * The words of the framework's own views — the 404 body and the records panel — in `view/i18n/<locale>.json`.
 *
 * They render where no plugin or theme dictionary is guaranteed (a 404 document, a page with no theme),
 * so they register into {@link FrameworkTranslations} like the share page does. A language is one more
 * JSON file here.
 */
export class ViewTranslations {
  private static registered = false;

  /** `key` in `locale` when the caller knows it (a server render), otherwise in the page's language. */
  static t(key: string, locale?: string, vars?: Record<string, unknown>): string {
    if (!ViewTranslations.registered) {
      FrameworkTranslations.registerAll({ en: EN as Record<string, unknown>, bg: BG as Record<string, unknown> });
      ViewTranslations.registered = true;
    }
    return FrameworkTranslations.in(locale || FrameworkTranslations.locale, key, vars);
  }
}

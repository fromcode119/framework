import { LocalizationUtils } from '@fromcode119/core/client';
import bg from '@/i18n/bg.json';
import en from '@/i18n/en.json';

/**
 * The storefront framework's own words — the banners, the sign-in fallbacks, the account cards, the
 * maintenance screen — in `packages/frontend/i18n/<locale>.json`.
 *
 * The locale is PASSED, never guessed: most of these render on the server, where there is no
 * `document`, so the caller hands over the locale it already resolved for `<html lang>`. Reading it
 * anywhere else would render English on the server and another language in the browser. Client-only
 * views pass {@link documentLocale}. A language is added by adding its JSON file to {@link PACKS}.
 */
export class FrontendCopy {
  private static readonly PACKS: Record<string, Record<string, unknown>> = { en, bg };

  /** `key` in `locale`, falling back to English and then to the key; `{{name}}` placeholders filled from `vars`. */
  static t(locale: string | undefined, key: string, vars?: Record<string, unknown>): string {
    const short = LocalizationUtils.normalizeLocaleCode(locale || FrontendCopy.documentLocale(), { short: true }) || 'en';
    const text = FrontendCopy.lookup(FrontendCopy.PACKS[short], key) ?? FrontendCopy.lookup(FrontendCopy.PACKS.en, key) ?? key;
    return Object.entries(vars || {}).reduce((out, [name, value]) => out.split(`{{${name}}}`).join(String(value ?? '')), text);
  }

  /** The `<html lang>` of the page, for views that only ever render in the browser. */
  static documentLocale(): string {
    return globalThis.document?.documentElement?.lang || 'en';
  }

  private static lookup(pack: Record<string, unknown> | undefined, key: string): string | undefined {
    const value = key.split('.').reduce<unknown>((node, part) => (node && Object.prototype.toString.call(node) === '[object Object]' ? (node as Record<string, unknown>)[part] : undefined), pack);
    return Object.prototype.toString.call(value) === '[object String]' ? String(value) : undefined;
  }
}

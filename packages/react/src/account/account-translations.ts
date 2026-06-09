import { ContextBridge } from '../context-bridge';
import EN from './i18n/en.json';
import BG from './i18n/bg.json';

/**
 * Registers the framework-default AccountShell copy so the shell renders complete on any install
 * with no plugins/theme. The words live in `./i18n/<locale>.json` (locale JSON, like every other
 * translation set). Only the ACTIVE locale's dataset is registered — the runtime translation
 * dictionary is flat/single-locale, so registering several would let one overwrite the others.
 *
 * The active locale comes from the runtime (which already resolves the system/admin/frontend default
 * locale settings) — we just match it against the available datasets by its base language code, with
 * no hardcoded locale branching. Adding a new translation file is the only change needed to support a
 * new language here.
 */
export class AccountTranslations {
  /** Available locale datasets, keyed by base language code. The first entry is the source-language fallback. */
  private static readonly DATASETS: Record<string, unknown> = { en: EN, bg: BG };
  private static registeredLocale: string | null = null;

  static register(locale?: string): void {
    const lang = AccountTranslations.resolveLanguage(locale);
    if (AccountTranslations.registeredLocale === lang) return;
    try {
      ContextBridge.registerTranslations(AccountTranslations.DATASETS[lang]);
      AccountTranslations.registeredLocale = lang;
    } catch {
      // bridge not ready yet — retried on next AccountShell render
    }
  }

  /** Base language code of the active locale (e.g. 'bg-BG' → 'bg') if a dataset exists, else the fallback. */
  private static resolveLanguage(locale?: string): string {
    const base = String(locale || '').toLowerCase().split(/[-_]/)[0];
    const fallback = Object.keys(AccountTranslations.DATASETS)[0];
    return base in AccountTranslations.DATASETS ? base : fallback;
  }
}

import { ContextBridge } from '../context-bridge';
import EN from './i18n/en.json';
import BG from './i18n/bg.json';

/**
 * Registers the framework-default AccountShell copy so the shell renders complete on any install
 * with no plugins/theme. The words live in `./i18n/<locale>.json` (locale JSON, like every other
 * translation set).
 *
 * Both languages are registered once as a per-locale map; the framework auto-detects the active
 * locale (`<html lang>` / configured default) and resolves the right language at lookup time. Adding
 * a new translation file is the only change needed to support a new language here.
 */
export class AccountTranslations {
  private static registered = false;

  static register(): void {
    if (AccountTranslations.registered) return;
    try {
      ContextBridge.registerTranslations({ en: EN, bg: BG });
      AccountTranslations.registered = true;
    } catch {
      // bridge not ready yet — retried on next AccountShell render
    }
  }
}

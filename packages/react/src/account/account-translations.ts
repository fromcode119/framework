import { ContextBridge } from '@react/context-bridge';
import { FrameworkTranslations } from '@react/i18n/framework-translations';
import EN from '@react/account/i18n/en.json';
import BG from '@react/account/i18n/bg.json';

/**
 * Registers the framework-default AccountShell copy so the shell renders complete on any install
 * with no plugins/theme. The words live in `./i18n/<locale>.json` (locale JSON, like every other
 * translation set).
 *
 * Both languages are registered once as a per-locale map; the framework auto-detects the active
 * locale (`<html lang>` / configured default) and resolves the right language at lookup time. Adding
 * a new translation file is the only change needed to support a new language here.
 *
 * Registration runs when this module is EVALUATED — before any account surface renders — and never from
 * a `render()`. `registerTranslations` updates the context provider's state, so calling it while another
 * component renders is a cross-component update React rejects ("Cannot update a component while
 * rendering a different component"). At evaluation the provider has usually not installed the bridge
 * yet; `ContextBridge.registerTranslations` then queues the copy for the provider, so it is in place for
 * the first render that reads it. Surfaces still call `register()` from `componentDidMount`; the call is
 * idempotent.
 */
export class AccountTranslations {
  private static registered = false;

  static register(): void {
    if (AccountTranslations.registered) return;
    // The provider-free floor, synchronous on the server as in the browser: a surface that renders on
    // the server (the standalone /unsubscribe panel) resolves its words from here in the document's locale.
    FrameworkTranslations.registerAll({ en: EN as any, bg: BG as any });
    ContextBridge.registerTranslations({ en: EN, bg: BG });
    AccountTranslations.registered = true;
  }

  static {
    AccountTranslations.register();
  }
}

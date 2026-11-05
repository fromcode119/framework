import { ContextBridge } from '@react/context-bridge';
import { FrameworkTranslations } from '@react/i18n/framework-translations';
import EN from '@react/auth/i18n/en.json';
import BG from '@react/auth/i18n/bg.json';

/**
 * Registers the framework-default AuthShell copy (sign in, register, forgot and reset password), so the
 * shell speaks the site's language on an install whose theme ships no auth words of its own — the same
 * arrangement as `AccountTranslations`. Without it the framework `/login` rendered English on a
 * Bulgarian shop. A theme that registers the same keys still wins; adding a language is one more file.
 *
 * Registered when this module is EVALUATED, never from a `render()` — see `AccountTranslations` for why.
 */
export class AuthTranslations {
  private static registered = false;

  static register(): void {
    if (AuthTranslations.registered) return;
    FrameworkTranslations.registerAll({ en: EN as any, bg: BG as any });
    ContextBridge.registerTranslations({ en: EN, bg: BG });
    AuthTranslations.registered = true;
  }

  static {
    AuthTranslations.register();
  }
}

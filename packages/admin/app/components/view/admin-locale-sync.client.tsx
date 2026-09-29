import type { ReactNode } from 'react';
import { Reactor } from '@fromcode119/react-class-components';
import { TranslationContext } from '@fromcode119/react';
import type { ITranslationContextValue } from '@fromcode119/react';
import { AdminConsoleLanguage } from '@/lib/i18n/admin-console-language';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * Makes the admin speak the reader's language: their own choice (account menu → Language), else
 * Settings → Localization → "Admin default locale".
 *
 * The root layout hardcodes `<html lang="en">` (it is a static server shell with no settings access), and
 * the i18n provider seeds its locale from that attribute — so `admin_default_locale` was a control whose
 * value only `LocalizedField` ever read: the operator could set Bulgarian and the admin kept translating
 * into English. This closes the loop: once the signed-in shell is up, read the setting and switch both
 * the console's own copy (`AdminI18n`, which also sets the `lang` attribute) and the plugins' locale.
 *
 * Renders nothing. Runs once per full page load; the localization settings page continues to own writes.
 */
export class AdminLocaleSync extends Reactor {
  static contextType = TranslationContext.Context;
  declare context: ITranslationContextValue;

  async componentDidMount(): Promise<void> {
    try {
      // The reader's own language first, then the site's default for anyone who has not chosen.
      const configured = (await AdminConsoleLanguage.current()).consoleLocale;
      if (!configured) return;
      // The console's own copy (AdminI18n) and the plugins' (the translation context) follow the same setting.
      AdminI18n.setLocale(configured);
      if (configured !== this.context?.locale) this.context?.setLocale?.(configured);
    } catch {
      // No settings (not signed in yet, API down) — keep the layout default rather than guessing.
    }
  }

  render(): ReactNode {
    return null;
  }
}

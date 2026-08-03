import type { ReactNode } from 'react';
import { Reactor, prop } from '@fromcode119/reactor';
import { Override } from '@react/view/override.client';
import { AccountShellDefault } from '@react/account/account-shell-default';
import { AccountTranslations } from '@react/account/account-translations';

/**
 * The account page — an overridable surface.
 *
 * The framework ships a complete one ({@link AccountShellDefault}: header, section nav, panel host) and a
 * theme that wants a DIFFERENT account entirely registers its own on this key:
 *
 *   ContextBridge.registerOverride(AccountShell.OVERRIDE, MyAccountShell, '<theme-slug>');
 *
 * A replacement is still driven by the same registry — `AccountSectionRegistry` over the `account.panels`
 * slot — so every plugin section (orders, courses, affiliate, …) keeps working in it without the theme
 * knowing any of them by name. Nothing about the account is fixed: the shell, its loading shape and every
 * class are all replaceable.
 */
export class AccountShell extends Reactor {
  /**
   * The override key for the whole account page. A plain string, because the override registry is a
   * GLOBAL namespace — a theme writes `'account.shell'` the same way it writes `'framework.page.404'`,
   * and nothing it registers should make it import from, or depend on, the component being replaced.
   */
  static readonly OVERRIDE = 'account.shell';

  @prop declare page?: any;

  /**
   * The framework's own account copy (the labels for overview/profile/security/sessions/two-factor) is
   * registered HERE, on the surface itself, not inside the default implementation. A theme that replaces
   * the shell replaces the layout — it must not have to re-ship the framework's words, and before this
   * those sections rendered as raw keys ("overview", "two-factor") in any replacement.
   */
  componentDidMount(): void {
    AccountTranslations.register();
  }

  render(): ReactNode {
    // Registering during render (not in a constructor) keeps this out of reactor's context-forwarding
    // trap and still lands before the first paint of whichever shell wins. The call is idempotent.
    AccountTranslations.register();
    return (
      <Override
        name={AccountShell.OVERRIDE}
        props={{ page: this.page }}
        fallback={<AccountShellDefault page={this.page} />}
      />
    );
  }
}

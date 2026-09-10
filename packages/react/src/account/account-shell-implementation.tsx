import type { ReactNode } from 'react';
import { Reactor, prop } from '@fromcode119/react-class-components';
import { Override } from '@react/view/override.client';
import { AccountShell } from '@react/account-shell';
import { AccountShellDefault } from '@react/account/account-shell-default';
import { AccountAuthGate } from '@react/account/account-auth-gate';
import { AccountTranslations } from '@react/account/account-translations';

/**
 * The account surface `AccountShell` renders inside its boundary: the auth gate around the
 * `account.shell` override, with the framework default behind it.
 *
 * Registers itself as the boundary's default on evaluation (static initialiser below), so the built
 * package renders it server-side with no wiring; the browser bridge swaps in a `React.lazy` of this
 * module instead, so it stays out of the storefront's first chunk.
 */
export class AccountShellImplementation extends Reactor {
  protected static readonly registeredAsDefault = AccountShell.implementation.provideDefault(AccountShellImplementation);

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
    // The gate wraps the OVERRIDE, not the default shell, for the same reason the translations above
    // are registered here: a theme replaces the account's LAYOUT, and must not be able to replace —
    // or be required to re-ship — what the surface itself owns. While the gate sat inside
    // `AccountShellDefault`, registering `account.shell` removed authentication along with the layout,
    // and this store's account (every section name, so the whole installed plugin set) rendered to
    // signed-out visitors with no redirect. A replacement shell can no longer opt out of it.
    return (
      <AccountAuthGate>
        <Override
          name={AccountShell.OVERRIDE}
          props={{ page: this.page }}
          fallback={<AccountShellDefault page={this.page} />}
        />
      </AccountAuthGate>
    );
  }
}

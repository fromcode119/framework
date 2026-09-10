import type { ReactNode } from 'react';
import { prop } from '@fromcode119/react-class-components';
import { ShellBoundary } from '@react/view/shell-boundary';
import { ShellImplementation } from '@react/shell-implementation';
import { AccountShellPlaceholder } from '@react/account/account-shell-placeholder';

/**
 * The account page — an overridable surface, rendered inside its Suspense boundary.
 *
 * The framework ships a complete one (`AccountShellDefault`: header, section nav, panel host) and a
 * theme that wants a DIFFERENT account entirely registers its own on this key:
 *
 *   ContextBridge.registerOverride(AccountShell.OVERRIDE, MyAccountShell, '<theme-slug>');
 *
 * A replacement is still driven by the same registry — `AccountSectionRegistry` over the `account.panels`
 * slot — so every plugin section (orders, courses, affiliate, …) keeps working in it without the theme
 * knowing any of them by name. Nothing about the account is fixed: the shell, its loading shape and every
 * class are all replaceable.
 *
 * This class is the BOUNDARY (see `ShellBoundary`); the surface itself — the auth gate around the
 * override — is `AccountShellImplementation`, static on the server and code-split in the browser.
 */
export class AccountShell extends ShellBoundary {
  /**
   * The override key for the whole account page. A plain string, because the override registry is a
   * GLOBAL namespace — a theme writes `'account.shell'` the same way it writes `'framework.page.404'`,
   * and nothing it registers should make it import from, or depend on, the component being replaced.
   */
  static readonly OVERRIDE = 'account.shell';

  /** Filled by `AccountShellImplementation` on evaluation; the browser bridge swaps in its lazy twin. */
  static readonly implementation = new ShellImplementation();

  @prop declare page?: any;

  protected get shellImplementation(): ShellImplementation {
    return AccountShell.implementation;
  }

  /**
   * The account's shape while the chunk loads. Without it the boundary renders nothing in that window —
   * a navbar, a footer and a hole — and the layout jumps when the real shell arrives.
   */
  protected get fallback(): ReactNode {
    return <AccountShellPlaceholder />;
  }
}

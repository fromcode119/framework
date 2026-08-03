import { ClientRuntimeConstants } from '@fromcode119/core/client';

/**
 * Class names for the account area, composed from the framework's own DOM prefix.
 *
 * The prefix is a framework-wide contract (`ClientRuntimeConstants.DOM_PREFIX`), so it belongs in one
 * place. Writing `'fc-acct-card'` as a literal in every panel meant the prefix could never change, and a
 * typo produced an unstyled element in silence rather than a compile error.
 *
 *   AccountClass.of('card')              // fc-acct-card
 *   AccountClass.of('btn', 'muted')      // fc-acct-btn fc-acct-btn--muted
 *   AccountClass.of('navlink', isActive && 'active')
 *
 * The stylesheet still spells the names out — CSS cannot import TypeScript — but there is now exactly
 * one authority for what they are.
 */
export class AccountClass {
  /** `fc-acct` — the account area's block name. */
  static readonly ROOT = `${ClientRuntimeConstants.DOM_PREFIX}acct`;

  /**
   * `fc-acct-tokens` — the account's colour/spacing custom properties WITHOUT the default shell's layout.
   *
   * The panels (framework's and every plugin's) are painted from these variables, but they used to be
   * declared only on `.fc-acct`, the default shell's own root. A theme that replaced the shell therefore
   * lost every token and its cards rendered borderless and transparent. A replacement carries this class
   * on its root and inherits the whole palette while keeping its own layout.
   */
  static readonly TOKENS = `${ClientRuntimeConstants.DOM_PREFIX}acct-tokens`;

  /** The custom property a stat card carries its contributing plugin's accent colour in. */
  static readonly STAT_ACCENT_VAR = `--${AccountClass.ROOT}-stat-accent`;

  /**
   * `of('card')` → the element class. Extra arguments are modifiers appended BEM-style; a falsy one is
   * skipped, so a conditional reads `of('navlink', isActive && 'active')`.
   */
  static of(element?: string, ...modifiers: Array<string | false | null | undefined>): string {
    const base = element ? `${AccountClass.ROOT}-${element}` : AccountClass.ROOT;
    const extra = modifiers
      .filter((modifier): modifier is string => Boolean(modifier))
      // `active` is a plain state class the nav already used; anything else is a BEM modifier.
      .map((modifier) => (modifier === 'active' ? 'active' : `${base}--${modifier}`));
    return [base, ...extra].join(' ');
  }
}

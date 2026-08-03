import type { ComponentType, ContextType, MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { Platform, Reactor, bound, prop, state } from '@fromcode119/reactor';
import { AccountRouteUtils } from '@fromcode119/core/client';
import { SlotsContext } from '@react/context/slots-context';
import { TranslationContext } from '@react/context/translation-context';
import { AccountTranslations } from '@react/account/account-translations';
// NOTE: `account-shell.css` is deliberately NOT imported here. A runtime `import '…css'` compiles to a
// `require()` in `dist`, which makes this package unimportable by NODE — and the stylesheet was never
// copied into `dist` either, so that require pointed at a file that does not exist. Bundlers hid it by
// resolving from source. The stylesheet now ships via the package's `copy:styles` step and is imported
// by the CONSUMER (see `packages/frontend/app/layout.tsx`), which keeps this module Node-importable so
// a theme's SSR bundle can load it.
import { AccountSectionIcons } from '@react/account/account-section-icons';
import { AccountSectionRegistry } from '@react/account/account-section-registry';
import { AccountAuthGate } from '@react/account/account-auth-gate';
import { AccountClass } from '@react/account/account-class';

/**
 * The framework's DEFAULT account page — the fallback behind the overridable `AccountShell`. Path-aware host for plugin-contributed account panels, shipping a
 * COMPLETE, presentable default design (header + icon sidebar + card main) that a theme may restyle by
 * overriding the `.fc-acct-*` classes — never required to make it usable.
 *
 * Panels register into the `account.panels` slot via
 * `ContextBridge.registerSlotComponent('account.panels', Component, '<slug>', priority)` and declare a
 * static `accountSection` descriptor ({ key, labelKey, priority, icon? }). The shell reads the active
 * section from the URL (`/account/:section`), builds the nav, and mounts only the active section's
 * panel(s) — so it adds no data fetches of its own (each panel fetches its own data when shown).
 */
export class AccountShellDefault extends Reactor {
  @prop declare page?: any;
  @state section: string = '';
  static contextType = TranslationContext.Context;
  declare context: ContextType<typeof TranslationContext.Context>;

  private readonly SLOT_NAME = 'account.panels';

  /** Framework-default account sections, owned by the framework (not a plugin). Plugins contribute
   * additional sections (orders, courses, …) via the `account.panels` slot and may override these by
   * registering a higher-priority panel for the same section key. */

  private boundPopState?: () => void;

  constructor(props: { page?: any }) {
    super(props);
    this.state = { section: AccountShellDefault.readSectionFromUrl() };
  }

  static readSectionFromUrl(): string {
    if (!Platform.isBrowser) return '';
    return AccountRouteUtils.parseSection(window.location.pathname);
  }

  componentDidMount(): void {
    AccountTranslations.register();
    if (Platform.isBrowser) {
      this.boundPopState = () => this.handlePopState();
      window.addEventListener('popstate', this.boundPopState);
    }
  }

  componentDidUpdate(): void {
    AccountTranslations.register();
  }

  componentWillUnmount(): void {
    if (Platform.isBrowser && this.boundPopState) {
      window.removeEventListener('popstate', this.boundPopState);
    }
  }

  handlePopState(): void {
    this.setState({ section: AccountShellDefault.readSectionFromUrl() });
  }

  /**
   * Intercept in-shell section navigation so switching sections is a client-side state change
   * (`history.pushState` + `setState`) instead of a full document load. A full reload re-fetches the
   * navbar/footer/auth/i18n/settings on every click — slow and enough to trip the API rate limit. The
   * `<a href>` is preserved so SSR / no-JS / middle-click / modified-click still navigate normally.
   */
  handleNavClick(event: ReactMouseEvent<HTMLAnchorElement>, sectionKey: string, href: string): void {
    this.navigateToSection(event, sectionKey, href);
  }

  /**
   * The same interception, handed to mounted panels so THEIR links into other sections behave like the
   * nav. Bound so it can be passed by reference.
   */
  @bound navigateToSection(event: ReactMouseEvent<HTMLAnchorElement>, sectionKey: string, href: string): void {
    if (event.defaultPrevented) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (Platform.isBrowser && window.history && typeof window.history.pushState === 'function') {
      window.history.pushState({}, '', href);
    }
    if (sectionKey !== this.section) this.setState({ section: sectionKey });
  }

  render(): ReactNode {
    // Gate the entire shell behind authentication — the account is client-rendered, so without this an
    // unauthenticated visitor could reach every panel. The gate renders a sign-in prompt for guests.
    return (
      <AccountAuthGate>
        <SlotsContext.Context.Consumer>
          {(slots) => (
            <TranslationContext.Context.Consumer>
              {(translation) => this.renderShell(slots, translation?.t)}
            </TranslationContext.Context.Consumer>
          )}
        </SlotsContext.Context.Consumer>
      </AccountAuthGate>
    );
  }

  private renderShell(slots: Record<string, any[]>, t?: (k: string, p?: any, d?: string) => string): ReactNode {
    const translate = typeof t === 'function' ? t : (_k: string, _p?: any, d?: string) => d || _k;
    const sections = AccountSectionRegistry.buildAll(slots[this.SLOT_NAME]);

    if (sections.length === 0) {
      return (
        <div className={AccountClass.of()}>
          <div className={AccountClass.of('empty')}>
            {translate('account.shell.empty', undefined, 'No account panels are available yet.')}
          </div>
        </div>
      );
    }

    const active = sections.find((s) => s.key === this.section) || sections[0];
    const activeLabel = translate(active.labelKey, undefined, active.labelKey);

    return (
      <div className={AccountClass.of()}>
        <header className={AccountClass.of('header')}>
          <div className={AccountClass.of('eyebrow')}>{translate('account.shell.title', undefined, 'My account')}</div>
          <h1 className={AccountClass.of('title')}>{activeLabel}</h1>
        </header>

        <div className={AccountClass.of('body')}>
          <nav className={AccountClass.of('nav')} aria-label={translate('account.shell.nav', undefined, 'Account sections')}>
            {sections.map((section) => {
              const isActive = section.key === active.key;
              return (
                <a
                  key={section.key}
                  href={AccountRouteUtils.sectionPath(section.key)}
                  onClick={(event) => this.handleNavClick(event, section.key, AccountRouteUtils.sectionPath(section.key))}
                  aria-current={isActive ? 'page' : undefined}
                  className={AccountClass.of('navlink', isActive && 'active')}
                >
                  <span className={AccountClass.of('navicon')} aria-hidden="true">{AccountSectionIcons.for(section.key, section.icon)}</span>
                  <span className={AccountClass.of('navlabel')}>{translate(section.labelKey, undefined, section.labelKey)}</span>
                </a>
              );
            })}
          </nav>

          <main className={AccountClass.of('main')}>
            {active.items.map((item, index) => {
              if (!item?.component) return null;
              const Panel = item.component as ComponentType<any>;
              // `sections` lets a panel link to other sections without knowing which plugins are
              // installed; `navigate` lets those links switch section in-shell, exactly like the nav —
              // a plain <a> would do a full document load and flash the site's default page first.
              return (
                <Panel
                  key={`${item.pluginSlug || 'p'}-${index}`}
                  page={this.page}
                  section={active.key}
                  sections={sections}
                  navigate={this.navigateToSection}
                />
              );
            })}
          </main>
        </div>
      </div>
    );
  }

}

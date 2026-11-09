import type { ComponentType, ContextType, MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { Platform, Reactor, bound, prop, state } from '@fromcode119/react-class-components';
import { AccountRouteUtils } from '@fromcode119/core/client';
import { SlotsContext } from '@react/context/slots-context';
import { TranslationContext } from '@react/context/translation-context';
import { PluginRuntimeContext } from '@react/view/plugin-runtime-context.client';
import { AccountTranslations } from '@react/account/account-translations';
// NOTE: `account-shell.css` is deliberately NOT imported here. A runtime `import '…css'` compiles to a
// `require()` in `dist`, which makes this package unimportable by NODE — and the stylesheet was never
// copied into `dist` either, so that require pointed at a file that does not exist. Bundlers hid it by
// resolving from source. The stylesheet now ships via the package's `copy:styles` step and is imported
// by the CONSUMER (see `packages/frontend/app/layout.tsx`), which keeps this module Node-importable so
// a theme's SSR bundle can load it.
import { AccountSectionIcons } from '@react/account/account-section-icons';
import { AccountSectionRegistry } from '@react/account/account-section-registry';
import { AccountClass } from '@react/account/account-class';
import { AccountSignOut } from '@react/account/sign-out';
import { AccountWho } from '@react/account/account-who';
import { AccountSummaryLoader } from '@react/account/account-summary-loader';
import { AccountSummaryStore } from '@react/account/account-summary-store';

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
  @state query: string = '';
  static contextType = TranslationContext.Context;
  declare context: ContextType<typeof TranslationContext.Context>;

  private readonly SLOT_NAME = 'account.panels';
  /** The framework's own overview section, which renders its own heading. */
  private static readonly OVERVIEW = 'overview';

  /** Framework-default account sections, owned by the framework (not a plugin). Plugins contribute
   * additional sections (orders, courses, …) via the `account.panels` slot and may override these by
   * registering a higher-priority panel for the same section key. */

  private boundPopState?: () => void;
  private unsubscribe?: () => void;

  constructor(props: { page?: any }) {
    super(props);
    this.state = { section: AccountShellDefault.readSectionFromUrl(), query: '' };
  }

  /** The requested section — the same answer on the server and in the browser (`RenderLocationUtils`). */
  static readSectionFromUrl(): string {
    return AccountRouteUtils.currentSection();
  }

  componentDidMount(): void {
    AccountTranslations.register();
    // Menu counts come from the shared summaries; re-render when they arrive.
    this.unsubscribe = AccountSummaryStore.subscribe(() => this.forceUpdate());
    if (Platform.isBrowser) {
      this.boundPopState = () => this.handlePopState();
      window.addEventListener('popstate', this.boundPopState);
    }
    this.revealActiveLink();
  }

  componentDidUpdate(): void {
    AccountTranslations.register();
    this.revealActiveLink();
  }

  /** On narrow screens the menu is one sideways-scrolling row: keep the open section's chip in view (sideways only, never the page). */
  private revealActiveLink(): void {
    if (!Platform.isBrowser) return;
    const list = document.querySelector<HTMLElement>(`.${AccountClass.of('navlist')}`);
    const link = list?.querySelector<HTMLElement>(`.${AccountClass.of('navlink')}.active`);
    if (!list || !link || list.scrollWidth <= list.clientWidth) return;
    list.scrollLeft = link.offsetLeft - list.offsetLeft - (list.clientWidth - link.offsetWidth) / 2;
  }

  componentWillUnmount(): void {
    this.unsubscribe?.();
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

  /**
   * No auth gate here. It used to wrap this render, which meant a theme registering its own
   * `account.shell` replaced the LAYOUT and silently took the AUTHENTICATION with it — the whole
   * account, every section name included, was reachable signed out. The gate now lives on the
   * surface ({@link AccountShell}), around the override, so replacing this shell cannot remove it.
   */
  render(): ReactNode {
    return (
      <SlotsContext.Context.Consumer>
        {(slots) => (
          <TranslationContext.Context.Consumer>
            {(translation) => (
              <PluginRuntimeContext.context.Consumer>
                {(runtime) => this.renderShell(slots, translation?.t, runtime?.globalSettings)}
              </PluginRuntimeContext.context.Consumer>
            )}
          </TranslationContext.Context.Consumer>
        )}
      </SlotsContext.Context.Consumer>
    );
  }

  /** Sections whose label or description contains the search words; every section when it is empty. */
  private matches(section: { labelKey: string; descriptionKey: string }, translate: (k: string, p?: any, d?: string) => string): boolean {
    const needle = this.query.trim().toLocaleLowerCase();
    if (!needle) return true;
    const label = translate(section.labelKey, undefined, section.labelKey);
    const description = translate(section.descriptionKey, undefined, '');
    return `${label} ${description}`.toLocaleLowerCase().includes(needle);
  }

  private renderNavGroups(sections: any[], activeKey: string, translate: (k: string, p?: any, d?: string) => string): ReactNode {
    const groups = AccountSectionRegistry.groups(sections)
      .map((group) => ({ ...group, sections: group.sections.filter((s) => this.matches(s, translate)) }))
      .filter((group) => group.sections.length > 0);
    if (groups.length === 0) {
      return <p className={AccountClass.of('nav-empty')}>{translate('account.shell.searchEmpty', undefined, 'Nothing matches.')}</p>;
    }
    return groups.map((group) => (
      <div key={group.key || 'ungrouped'} className={AccountClass.of('navgroup')}>
        {group.key ? <span className={AccountClass.of('navgroup-label')}>{translate(group.labelKey, undefined, group.labelKey)}</span> : null}
        {group.sections.map((section) => {
          const isActive = section.key === activeKey;
          const href = AccountRouteUtils.sectionPath(section.key);
          return (
            <a
              key={section.key}
              href={href}
              onClick={(event) => this.handleNavClick(event, section.key, href)}
              aria-current={isActive ? 'page' : undefined}
              className={AccountClass.of('navlink', isActive && 'active')}
            >
              <span className={AccountClass.of('navicon')} aria-hidden="true">{AccountSectionIcons.for(section.key, section.icon)}</span>
              <span className={AccountClass.of('navlabel')}>{translate(section.labelKey, undefined, section.labelKey)}</span>
              {this.renderCount(section.key)}
            </a>
          );
        })}
      </div>
    ));
  }

  /** The section's count from its contributor, when it has one; nothing otherwise. */
  private renderCount(key: string): ReactNode {
    const count = AccountSummaryStore.section(key)?.count;
    return count ? <span className={AccountClass.of('navcount')}>{count}</span> : null;
  }

  private renderShell(slots: Record<string, any[]>, t?: (k: string, p?: any, d?: string) => string, globalSettings?: Record<string, unknown>): ReactNode {
    const translate = typeof t === 'function' ? t : (_k: string, _p?: any, d?: string) => d || _k;
    const sections = AccountSectionRegistry.buildAll(slots[this.SLOT_NAME], globalSettings);

    if (sections.length === 0) {
      return (
        <div className={AccountClass.of()}>
          <div className={AccountClass.of('empty')}>
            {translate('account.shell.empty', undefined, 'No account panels are available yet.')}
          </div>
        </div>
      );
    }

    const active = AccountSectionRegistry.resolve(sections, this.section) || sections[0];
    const activeLabel = translate(active.labelKey, undefined, active.labelKey);
    const activeDescription = active.descriptionKey ? translate(active.descriptionKey, undefined, '') : '';

    return (
      <div className={AccountClass.of()}>
        <div className={AccountClass.of('body')}>
          <nav className={AccountClass.of('nav')} aria-label={translate('account.shell.nav', undefined, 'Account sections')}>
            <AccountSummaryLoader contributors={slots['account.overview.stats'] || []} />
            <AccountWho />
            <label className={AccountClass.of('search')}>
              <span className={AccountClass.of('sronly')}>{translate('account.shell.search', undefined, 'Search your account')}</span>
              <input
                type="search"
                className={AccountClass.of('search-input')}
                value={this.query}
                placeholder={translate('account.shell.searchPlaceholder', undefined, 'Search your account')}
                onChange={(event) => this.setState({ query: event.target.value })}
              />
            </label>
            <div className={AccountClass.of('navlist')}>{this.renderNavGroups(sections, active.key, translate)}</div>
            <AccountSignOut />
          </nav>

          <main className={AccountClass.of('main')}>
            {/* The overview heads itself: its title is the greeting ("Hello, Rosen"), and a second
                "Overview" heading above it would say the same thing twice. */}
            {active.key === AccountShellDefault.OVERVIEW ? null : (
              <header className={AccountClass.of('header')}>
                <h1 className={AccountClass.of('title')}>{activeLabel}</h1>
                {activeDescription ? <p className={AccountClass.of('lead')}>{activeDescription}</p> : null}
              </header>
            )}
            {active.items.map((item, index) => {
              if (!item?.component) return null;
              const Panel = item.component as ComponentType<any>;
              // `sections` lets a panel link to other sections without knowing which plugins are
              // installed; `navigate` lets those links switch section in-shell, exactly like the nav —
              // a plain <a> would do a full document load and flash the site's default page first.
              // `summariesChanged` is for a panel that added or removed something: the menu counts refetch.
              return (
                <Panel
                  key={`${item.pluginSlug || 'p'}-${index}`}
                  page={this.page}
                  section={active.key}
                  sections={sections}
                  navigate={this.navigateToSection}
                  summariesChanged={AccountSummaryStore.reload}
                />
              );
            })}
          </main>
        </div>
      </div>
    );
  }

}

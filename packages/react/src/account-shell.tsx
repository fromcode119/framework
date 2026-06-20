"use client";

import React from 'react';
import { AccountRouteUtils } from '@fromcode119/core/client';
import { SlotsContext } from './context/slots-context';
import { TranslationContext } from './context/translation-context';
import { AccountOverviewPanel } from './account/overview-panel';
import { AccountProfilePanel } from './account/profile-panel';
import { AccountSecurityPanel } from './account/security-panel';
import { AccountSessionsPanel } from './account/sessions-panel';
import { AccountTwoFactorPanel } from './account/two-factor-panel';
import { AccountTranslations } from './account/account-translations';
import './account/account-shell.css';
import { AccountSectionIcons } from './account/account-section-icons';
import { AccountAuthGate } from './account/account-auth-gate';

/**
 * Framework-default account page. Path-aware host for plugin-contributed account panels, shipping a
 * COMPLETE, presentable default design (header + icon sidebar + card main) that a theme may restyle by
 * overriding the `.fc-acct-*` classes — never required to make it usable.
 *
 * Panels register into the `account.panels` slot via
 * `ContextBridge.registerSlotComponent('account.panels', Component, '<slug>', priority)` and declare a
 * static `accountSection` descriptor ({ key, labelKey, priority, icon? }). The shell reads the active
 * section from the URL (`/account/:section`), builds the nav, and mounts only the active section's
 * panel(s) — so it adds no data fetches of its own (each panel fetches its own data when shown).
 */
export class AccountShell extends React.Component<{ page?: any }, { section: string }> {
  static contextType = TranslationContext.Context;
  declare context: React.ContextType<typeof TranslationContext.Context>;

  private readonly SLOT_NAME = 'account.panels';

  /** Framework-default account sections, owned by the framework (not a plugin). Plugins contribute
   * additional sections (orders, courses, …) via the `account.panels` slot and may override these by
   * registering a higher-priority panel for the same section key. */
  private static readonly BUILTIN: Array<{ component: any; pluginSlug: string }> = [
    { component: AccountOverviewPanel, pluginSlug: 'framework' },
    { component: AccountProfilePanel, pluginSlug: 'framework' },
    { component: AccountSecurityPanel, pluginSlug: 'framework' },
    { component: AccountSessionsPanel, pluginSlug: 'framework' },
    { component: AccountTwoFactorPanel, pluginSlug: 'framework' },
  ];

  private boundPopState?: () => void;

  constructor(props: { page?: any }) {
    super(props);
    this.state = { section: AccountShell.readSectionFromUrl() };
  }

  static readSectionFromUrl(): string {
    if (typeof window === 'undefined') return '';
    return AccountRouteUtils.parseSection(window.location.pathname);
  }

  componentDidMount(): void {
    AccountTranslations.register();
    if (typeof window !== 'undefined') {
      this.boundPopState = () => this.handlePopState();
      window.addEventListener('popstate', this.boundPopState);
    }
  }

  componentDidUpdate(): void {
    AccountTranslations.register();
  }

  componentWillUnmount(): void {
    if (typeof window !== 'undefined' && this.boundPopState) {
      window.removeEventListener('popstate', this.boundPopState);
    }
  }

  handlePopState(): void {
    this.setState({ section: AccountShell.readSectionFromUrl() });
  }

  /**
   * Intercept in-shell section navigation so switching sections is a client-side state change
   * (`history.pushState` + `setState`) instead of a full document load. A full reload re-fetches the
   * navbar/footer/auth/i18n/settings on every click — slow and enough to trip the API rate limit. The
   * `<a href>` is preserved so SSR / no-JS / middle-click / modified-click still navigate normally.
   */
  handleNavClick(event: React.MouseEvent<HTMLAnchorElement>, sectionKey: string, href: string): void {
    if (event.defaultPrevented) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (typeof window !== 'undefined' && window.history && typeof window.history.pushState === 'function') {
      window.history.pushState({}, '', href);
    }
    if (sectionKey !== this.state.section) this.setState({ section: sectionKey });
  }

  render(): React.ReactNode {
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

  private renderShell(slots: Record<string, any[]>, t?: (k: string, p?: any, d?: string) => string): React.ReactNode {
    const translate = typeof t === 'function' ? t : (_k: string, _p?: any, d?: string) => d || _k;
    const sections = AccountShell.buildSections([...AccountShell.BUILTIN, ...(slots[this.SLOT_NAME] || [])]);

    if (sections.length === 0) {
      return (
        <div className="fc-acct">
          <div className="fc-acct-empty">
            {translate('account.shell.empty', undefined, 'No account panels are available yet.')}
          </div>
        </div>
      );
    }

    const active = sections.find((s) => s.key === this.state.section) || sections[0];
    const activeLabel = translate(active.labelKey, undefined, active.labelKey);

    return (
      <div className="fc-acct">
        <header className="fc-acct-header">
          <div className="fc-acct-eyebrow">{translate('account.shell.title', undefined, 'My account')}</div>
          <h1 className="fc-acct-title">{activeLabel}</h1>
        </header>

        <div className="fc-acct-body">
          <nav className="fc-acct-nav" aria-label={translate('account.shell.nav', undefined, 'Account sections')}>
            {sections.map((section) => {
              const isActive = section.key === active.key;
              return (
                <a
                  key={section.key}
                  href={AccountRouteUtils.sectionPath(section.key)}
                  onClick={(event) => this.handleNavClick(event, section.key, AccountRouteUtils.sectionPath(section.key))}
                  aria-current={isActive ? 'page' : undefined}
                  className={`fc-acct-navlink${isActive ? ' active' : ''}`}
                >
                  <span className="fc-acct-navicon" aria-hidden="true">{AccountSectionIcons.for(section.key)}</span>
                  <span className="fc-acct-navlabel">{translate(section.labelKey, undefined, section.labelKey)}</span>
                </a>
              );
            })}
          </nav>

          <main className="fc-acct-main">
            {active.items.map((item, index) =>
              item?.component
                ? React.createElement(item.component, { page: this.props.page, section: active.key, key: `${item.pluginSlug || 'p'}-${index}` })
                : null,
            )}
          </main>
        </div>
      </div>
    );
  }

  private static buildSections(panels: any[]): Array<{ key: string; labelKey: string; priority: number; items: any[] }> {
    const byKey = new Map<string, { key: string; labelKey: string; priority: number; items: any[] }>();
    panels.forEach((item, index) => {
      const meta = (item?.component && (item.component as any).accountSection) || {};
      const key = String(meta.key || item?.pluginSlug || `section-${index}`).toLowerCase();
      const labelKey = String(meta.labelKey || meta.label || meta.key || item?.pluginSlug || key);
      const priority = typeof meta.priority === 'number' ? meta.priority : 100;
      const existing = byKey.get(key);
      if (existing) {
        existing.items.push(item);
        existing.priority = Math.min(existing.priority, priority);
      } else {
        byKey.set(key, { key, labelKey, priority, items: [item] });
      }
    });
    return Array.from(byKey.values()).sort((a, b) => a.priority - b.priority || a.key.localeCompare(b.key));
  }
}

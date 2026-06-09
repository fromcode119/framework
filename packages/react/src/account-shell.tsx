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

/**
 * Framework-default account page. Path-aware host for plugin-contributed account panels.
 *
 * Panels register into the `account.panels` slot via
 * `ContextBridge.registerSlotComponent('account.panels', Component, '<slug>', priority)` and declare a
 * static `accountSection` descriptor so the shell can build section navigation and route by URL:
 *
 *   class OrdersPanel extends React.Component {
 *     static accountSection = { key: 'orders', labelKey: 'ecommerce.account.orders', icon: 'shopping-bag', priority: 20 };
 *   }
 *
 * The shell reads the active section from the URL (`/account/:section`), renders a section nav (real
 * links so each section is its own URL), and mounts the active section's panel(s). Multiple panels may
 * share a section key (they stack within it). Renders standalone with no theme and no plugins (empty
 * state). Section labels go through i18n; the active user is resolved per-panel server-side.
 */
export class AccountShell extends React.Component<{ page?: any }, { section: string }> {
  // Read the active locale in lifecycle (componentDidMount/Update) so the default-copy registration
  // picks the right dataset. The Consumer in render() still supplies `t` to the panels.
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

  constructor(props: { page?: any }) {
    super(props);
    this.state = { section: AccountShell.readSectionFromUrl() };
    this.handlePopState = this.handlePopState.bind(this);
  }

  static readSectionFromUrl(): string {
    if (typeof window === 'undefined') return '';
    return AccountRouteUtils.parseSection(window.location.pathname);
  }

  componentDidMount(): void {
    AccountTranslations.register(this.context?.locale);
    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', this.handlePopState);
    }
  }

  componentDidUpdate(): void {
    // Locale can change after mount (language switch) — re-register the matching dataset.
    AccountTranslations.register(this.context?.locale);
  }

  componentWillUnmount(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('popstate', this.handlePopState);
    }
  }

  handlePopState(): void {
    this.setState({ section: AccountShell.readSectionFromUrl() });
  }

  render(): React.ReactNode {
    return (
      <SlotsContext.Context.Consumer>
        {(slots) => (
          <TranslationContext.Context.Consumer>
            {(translation) => this.renderShell(slots, translation?.t)}
          </TranslationContext.Context.Consumer>
        )}
      </SlotsContext.Context.Consumer>
    );
  }

  private renderShell(slots: Record<string, any[]>, t?: (k: string, p?: any, d?: string) => string): React.ReactNode {
    const translate = typeof t === 'function' ? t : (_k: string, _p?: any, d?: string) => d || _k;
    // Framework-default sections first, then plugin-contributed ones (priority sorts them anyway).
    const sections = AccountShell.buildSections([...AccountShell.BUILTIN, ...(slots[this.SLOT_NAME] || [])]);

    const container: React.CSSProperties = { maxWidth: '1024px', margin: '0 auto', padding: '40px 24px' };
    if (sections.length === 0) {
      return (
        <div style={container}>
          <div style={{ color: '#64748b' }}>
            {translate('account.shell.empty', undefined, 'No account panels are available yet.')}
          </div>
        </div>
      );
    }

    const active = sections.find((s) => s.key === this.state.section) || sections[0];

    return (
      <div style={container}>
        <nav
          aria-label={translate('account.shell.nav', undefined, 'Account sections')}
          style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}
        >
          {sections.map((section) => {
            const isActive = section.key === active.key;
            return (
              <a
                key={section.key}
                href={AccountRouteUtils.sectionPath(section.key)}
                aria-current={isActive ? 'page' : undefined}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? '#ffffff' : '#334155',
                  background: isActive ? '#7c3aed' : 'transparent',
                }}
              >
                {translate(section.labelKey, undefined, section.labelKey)}
              </a>
            );
          })}
        </nav>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {active.items.map((item, index) =>
            item?.component
              ? React.createElement(item.component, { page: this.props.page, section: active.key, key: `${item.pluginSlug || 'p'}-${index}` })
              : null,
          )}
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

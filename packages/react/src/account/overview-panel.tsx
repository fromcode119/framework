import React from 'react';
import { RouteConstants, AccountRouteUtils } from '@fromcode119/core/client';
import { PluginComponent } from '../plugin-component';
import { AccountAuthClient } from './auth-client';

interface AccountOverviewPanelState {
  loading: boolean;
  person: Record<string, any> | null;
}

/**
 * Plugin-owned Overview/landing section for the framework AccountShell. Greets the signed-in person
 * and links to the other account sections. Priority -10 so it is the default section at `/account`.
 */
export class AccountOverviewPanel extends PluginComponent<Record<string, unknown>, AccountOverviewPanelState> {
  static readonly accountSection = { key: 'overview', labelKey: 'account.section.overview', priority: -10 };

  private mounted = false;

  state: AccountOverviewPanelState = { loading: true, person: null };

  private get client(): any {
    return AccountAuthClient.of(this.api);
  }

  componentDidMount(): void {
    this.mounted = true;
    void this.load();
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private async load(): Promise<void> {
    try {
      const res = await this.client.get(RouteConstants.SEGMENTS.ME_PERSON, { silent: true });
      const person = res?.person ?? res?.data?.person ?? null;
      if (this.mounted) this.setState({ person: person || {}, loading: false });
    } catch {
      if (this.mounted) this.setState({ loading: false });
    }
  }

  private renderLink(key: string): React.ReactNode {
    return (
      <a
        key={key}
        href={AccountRouteUtils.sectionPath(key)}
        style={{ display: 'block', padding: '16px 18px', border: '1px solid #e2e8f0', borderRadius: '12px', textDecoration: 'none', color: '#1a1a2e', fontWeight: 600, background: '#fff' }}
      >
        {this.t(`account.section.${key}`, undefined, key)}
      </a>
    );
  }

  render(): React.ReactNode {
    const { loading, person } = this.state;
    const card: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' };
    const name = String(person?.displayName || person?.firstName || '').trim();
    return (
      <div style={card}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 6px' }}>
          {name ? this.t('account.overview.greeting', { name }, `Welcome, ${name}`) : this.t('account.overview.greetingAnon', undefined, 'Welcome')}
        </h2>
        <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 20px' }}>{this.t('account.overview.intro')}</p>
        {!loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
            {['profile', 'orders', 'subscription', 'courses', 'partner'].map((k) => this.renderLink(k))}
          </div>
        ) : null}
      </div>
    );
  }
}

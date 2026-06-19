import React from 'react';
import { RouteConstants, AccountRouteUtils } from '@fromcode119/core/client';
import { PluginComponent } from '../plugin-component';
import { AccountAuthClient } from './auth-client';
import { AccountOverviewStatsBuilder } from './overview-stats-builder';

interface AccountOverviewPanelState {
  loading: boolean;
  person: Record<string, any> | null;
  stats: any[];
}

/**
 * Framework Overview/landing section for the AccountShell. Greets the signed-in person and shows a
 * dashboard of stat cards (orders + total spent, reward points + EUR value, subscription, enrolled
 * courses, partner code + commissions) pulled live from whichever plugin account APIs are installed —
 * each fetched defensively so a missing/erroring plugin simply drops its card. Priority -10 so it is
 * the default section at `/account`.
 */
export class AccountOverviewPanel extends PluginComponent<Record<string, unknown>, AccountOverviewPanelState> {
  static readonly accountSection = { key: 'overview', labelKey: 'account.section.overview', priority: -10 };

  private mounted = false;

  state: AccountOverviewPanelState = { loading: true, person: null, stats: [] };

  private get client(): any {
    return AccountAuthClient.of(this.api);
  }

  private ns(slug: string): any {
    try { return this.namespace('org.fromcode')?.[slug] || null; } catch { return null; }
  }

  componentDidMount(): void {
    this.mounted = true;
    void this.loadAll();
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private async safe(fn: () => any): Promise<any> {
    try { const value = fn(); return value && typeof value.then === 'function' ? await value : value; } catch { return null; }
  }

  private async loadAll(attempt: number = 0): Promise<void> {
    const [person, orders, sub, courses, portal] = await Promise.all([
      this.safe(() => this.client.get(RouteConstants.SEGMENTS.ME_PERSON, { silent: true })),
      this.safe(() => this.ns('ecommerce')?.listMyOrders({}, { silent: true, noDedupe: true })),
      this.safe(() => this.ns('subscriptions')?.getMySubscription({ silent: true })),
      this.safe(() => this.ns('lms')?.getMyEnrollments({ silent: true })),
      this.safe(() => this.ns('mlm')?.getPortalMe({ silent: true })),
    ]);
    if (!this.mounted) return;
    const personObj = person?.person ?? person?.data?.person ?? null;
    const stats = AccountOverviewStatsBuilder.build({ orders, sub, courses, portal }, this.t);
    // Plugin namespaces/auth can resolve a beat after mount, intermittently returning null and dropping
    // a card. Keep the RICHEST result across a couple of retries so the overview renders deterministically
    // instead of flickering between partial and full.
    const best = stats.length >= (this.state.stats?.length || 0) ? stats : this.state.stats;
    this.setState({ loading: false, person: personObj || (this.state.person || {}), stats: best });
    const hadNullSource = [orders, sub, courses, portal].some((result) => result == null);
    if (attempt < 2 && hadNullSource) {
      window.setTimeout(() => { if (this.mounted) void this.loadAll(attempt + 1); }, 600);
    }
  }

  private renderStatCard(stat: any): React.ReactNode {
    return (
      <a
        key={stat.key}
        href={stat.href}
        style={{ display: 'block', padding: '18px 20px', border: '1px solid #e2e8f0', borderRadius: '16px', textDecoration: 'none', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', borderTop: `3px solid ${stat.accent}` }}
      >
        <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.12em', color: '#64748b', fontWeight: 700 }}>{stat.label}</div>
        <div style={{ fontSize: '1.7rem', fontWeight: 800, color: '#1a1a2e', margin: '6px 0 2px', lineHeight: 1.1, wordBreak: 'break-word' }}>{stat.value}</div>
        {stat.sub ? <div style={{ fontSize: '13px', color: '#64748b' }}>{stat.sub}</div> : null}
      </a>
    );
  }

  private renderQuickLink(key: string): React.ReactNode {
    return (
      <a
        key={key}
        href={AccountRouteUtils.sectionPath(key)}
        style={{ display: 'block', padding: '14px 16px', border: '1px solid #e2e8f0', borderRadius: '12px', textDecoration: 'none', color: '#1a1a2e', fontWeight: 600, background: '#fff' }}
      >
        {this.t(`account.section.${key}`, undefined, key)}
      </a>
    );
  }

  render(): React.ReactNode {
    const { loading, person, stats } = this.state;
    const card: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' };
    const name = String(person?.displayName || person?.firstName || '').trim();
    return (
      <div style={{ display: 'grid', gap: '20px' }}>
        <div style={card}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 6px' }}>
            {name ? this.t('account.overview.greeting', { name }, `Welcome, ${name}`) : this.t('account.overview.greetingAnon', undefined, 'Welcome')}
          </h2>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>{this.t('account.overview.intro')}</p>
        </div>

        {loading ? (
          <div style={{ ...card, color: '#64748b', fontSize: '14px' }}>{this.t('account.overview.loading', undefined, 'Loading your account…')}</div>
        ) : (
          <>
            {stats.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '14px' }}>
                {stats.map((stat) => this.renderStatCard(stat))}
              </div>
            ) : null}

            <div style={card}>
              <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748b', fontWeight: 700, marginBottom: '12px' }}>
                {this.t('account.overview.manage', undefined, 'Manage your account')}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '12px' }}>
                {['profile', 'orders', 'subscription', 'courses', 'affiliate', 'security'].map((k) => this.renderQuickLink(k))}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }
}

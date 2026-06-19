import React from 'react';
import { RouteConstants } from '@fromcode119/core/client';
import { PluginComponent } from '../plugin-component';
import { AccountAuthClient } from './auth-client';
import { AccountTranslations } from './account-translations';

interface AccountAuthGateState {
  status: 'checking' | 'authed' | 'guest';
}

/**
 * Auth gate for the framework AccountShell. The account renders client-side, so without this the full
 * shell (and every panel's data) is reachable by an unauthenticated visitor. The gate verifies the
 * session via `auth/me` on mount and ONLY renders its children when a real user is returned; otherwise
 * it shows a sign-in prompt and redirects to `/login?next=<path>` — failing CLOSED on any error so no
 * account content ever leaks to a guest.
 */
export class AccountAuthGate extends PluginComponent<{ children?: React.ReactNode }, AccountAuthGateState> {
  private mounted = false;

  state: AccountAuthGateState = { status: 'checking' };

  componentDidMount(): void {
    this.mounted = true;
    AccountTranslations.register();
    void this.check();
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private async check(): Promise<void> {
    try {
      // `/auth/me/person` returns the signed-in person (200) and 401s for guests — the authoritative
      // session probe (`/auth/me` does not exist; `/auth/status` only reports install state).
      const res = await AccountAuthClient.of(this.api).get(RouteConstants.SEGMENTS.ME_PERSON, { silent: true });
      const person = res?.person ?? res?.data?.person ?? null;
      const ok = Boolean(person && typeof person === 'object' && (person.id || person.userId || person.email));
      if (this.mounted) this.setState({ status: ok ? 'authed' : 'guest' });
      if (!ok) this.redirectToLogin();
    } catch {
      if (this.mounted) this.setState({ status: 'guest' });
      this.redirectToLogin();
    }
  }

  private redirectToLogin(): void {
    if (typeof window === 'undefined') return;
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    // Framework-owned login path (RouteConstants), not a hardcoded literal.
    window.location.replace(`${RouteConstants.SEGMENTS.LOGIN}?next=${next}`);
  }

  render(): React.ReactNode {
    if (this.state.status === 'authed') return this.props.children;
    const card: React.CSSProperties = { maxWidth: '420px', margin: '64px auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '32px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' };
    return (
      <div style={card}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: '0 0 8px' }}>{this.t('account.gate.title', undefined, 'Please sign in')}</h2>
        <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 20px' }}>{this.t('account.gate.body', undefined, 'You need to be signed in to view your account.')}</p>
        <a href="/login" style={{ display: 'inline-block', padding: '10px 22px', borderRadius: '10px', background: '#4f46e5', color: '#fff', textDecoration: 'none', fontWeight: 600, fontSize: '14px' }}>
          {this.t('account.gate.login', undefined, 'Sign in')}
        </a>
      </div>
    );
  }
}

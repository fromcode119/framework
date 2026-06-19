import React from 'react';
import { RouteConstants } from '@fromcode119/core/client';
import { PluginComponent } from '../plugin-component';
import { AccountAuthClient } from './auth-client';
import { AccountSessionDeviceService } from './session-device-service';

interface AccountSessionsPanelState {
  loading: boolean;
  revoking: boolean;
  revokingId: string;
  error: string;
  sessions: any[];
}

/** Plugin-owned default Sessions section for the framework AccountShell. Lists the signed-in user's
 * active sessions with device/browser, IP and start time, marks the current one, and lets them sign
 * out a single session or all the others. Registered into `account.panels`. */
export class AccountSessionsPanel extends PluginComponent<Record<string, unknown>, AccountSessionsPanelState> {
  static readonly accountSection = { key: 'sessions', labelKey: 'account.section.sessions', priority: 65 };

  private mounted = false;

  state: AccountSessionsPanelState = { loading: true, revoking: false, revokingId: '', error: '', sessions: [] };

  componentDidMount(): void {
    this.mounted = true;
    void this.load();
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private async load(): Promise<void> {
    try {
      const data = await AccountAuthClient.of(this.api).get(RouteConstants.SEGMENTS.SESSIONS_ME, { silent: true });
      const rows = data?.docs ?? data?.data ?? data?.sessions ?? (Array.isArray(data) ? data : []);
      if (this.mounted) this.setState({ sessions: Array.isArray(rows) ? rows : [], loading: false });
    } catch (error: any) {
      if (this.mounted) this.setState({ error: String(error?.message || error), loading: false });
    }
  }

  private async revokeOthers(): Promise<void> {
    this.setState({ revoking: true });
    try {
      await AccountAuthClient.of(this.api).post(RouteConstants.SEGMENTS.SESSIONS_REVOKE_OTHERS, {});
      await this.load();
      if (this.mounted) this.setState({ revoking: false });
    } catch (error: any) {
      if (this.mounted) this.setState({ revoking: false, error: String(error?.message || error) });
    }
  }

  private async revokeOne(id: string): Promise<void> {
    if (!id) return;
    this.setState({ revokingId: id, error: '' });
    try {
      const path = String(RouteConstants.SEGMENTS.SESSIONS_ID_REVOKE).replace(':id', encodeURIComponent(id));
      const res = await AccountAuthClient.of(this.api).post(path, {});
      // Revoking the current session signs this device out — send the user back to a clean state.
      if (res?.revokedCurrent && typeof window !== 'undefined') { window.location.href = '/'; return; }
      await this.load();
      if (this.mounted) this.setState({ revokingId: '' });
    } catch (error: any) {
      if (this.mounted) this.setState({ revokingId: '', error: String(error?.message || error) });
    }
  }

  private formatDate(value: any): string {
    const d = value ? new Date(String(value)) : null;
    return d && !Number.isNaN(d.getTime()) ? d.toLocaleString(this.locale || 'bg-BG') : '';
  }

  private renderRow(s: any, i: number): React.ReactNode {
    // The sessions API may return camelCase (mapped) or raw snake_case rows — read both so the device,
    // IP and time always render (this is what made /account/sessions look empty before).
    const current = Boolean(s?.current ?? s?.isCurrent ?? s?.is_current);
    const id = String(s?.id ?? '');
    const ua = String(s?.userAgent ?? s?.user_agent ?? s?.device ?? '');
    const device = AccountSessionDeviceService.label(ua) || this.t('account.sessions.unknownDevice');
    const ip = String(s?.ipAddress ?? s?.ip_address ?? s?.ip ?? '').trim();
    const started = this.formatDate(s?.lastActiveAt ?? s?.last_active_at ?? s?.lastActivityAt ?? s?.last_activity_at ?? s?.createdAt ?? s?.created_at);
    const busy = this.state.revokingId === id;
    return (
      <div key={id || i} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: 600 }}>{device}</div>
          {ip ? <div style={{ fontSize: '12px', color: '#64748b' }}>{this.t('account.sessions.ip')}: {ip}</div> : null}
          {started ? <div style={{ fontSize: '12px', color: '#64748b' }}>{this.t('account.sessions.created')}: {started}</div> : null}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {current ? <span style={{ fontSize: '12px', fontWeight: 600, color: '#15803d' }}>{this.t('account.sessions.current')}</span> : null}
          {id ? (
            <button onClick={() => void this.revokeOne(id)} disabled={busy} style={{ padding: '6px 14px', background: 'transparent', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '999px', fontSize: '12px', fontWeight: 600, cursor: busy ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>
              {busy ? this.t('account.sessions.revokingOne') : this.t('account.sessions.revoke')}
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  render(): React.ReactNode {
    const { loading, revoking, error, sessions } = this.state;
    const card: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' };
    if (loading) return <div style={card}>{this.t('account.sessions.loading')}</div>;
    return (
      <div style={card}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 18px' }}>{this.t('account.section.sessions')}</h2>
        {error ? <p style={{ color: '#dc2626', fontSize: '13px' }}>{error}</p> : null}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
          {sessions.map((s, i) => this.renderRow(s, i))}
          {sessions.length === 0 ? <p style={{ color: '#64748b', fontSize: '14px' }}>{this.t('account.sessions.none')}</p> : null}
        </div>
        <button onClick={() => void this.revokeOthers()} disabled={revoking} style={{ padding: '10px 22px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '999px', fontSize: '14px', fontWeight: 600, cursor: revoking ? 'default' : 'pointer' }}>
          {revoking ? this.t('account.sessions.revoking') : this.t('account.sessions.revokeOthers')}
        </button>
      </div>
    );
  }
}

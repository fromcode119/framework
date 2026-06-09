import React from 'react';
import { RouteConstants } from '@fromcode119/core/client';
import { PluginComponent } from '../plugin-component';
import { AccountAuthClient } from './auth-client';

interface AccountTwoFactorPanelState {
  loading: boolean;
  busy: boolean;
  enabled: boolean;
  setupSecret: string;
  recoveryCodes: string[];
  token: string;
  message: string;
  isError: boolean;
}

/** Plugin-owned default Two-Factor section for the framework AccountShell. Shows 2FA status and runs
 * the setup → verify → disable flow against the framework auth API. Registered into `account.panels`. */
export class AccountTwoFactorPanel extends PluginComponent<Record<string, unknown>, AccountTwoFactorPanelState> {
  static readonly accountSection = { key: 'two-factor', labelKey: 'account.section.two-factor', priority: 70 };

  private mounted = false;

  state: AccountTwoFactorPanelState = { loading: true, busy: false, enabled: false, setupSecret: '', recoveryCodes: [], token: '', message: '', isError: false };

  componentDidMount(): void {
    this.mounted = true;
    void this.loadStatus();
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private get auth(): any {
    return AccountAuthClient.of(this.api);
  }

  private async loadStatus(): Promise<void> {
    try {
      const data = await this.auth.get(RouteConstants.SEGMENTS.TWO_FACTOR_STATUS, { silent: true });
      if (this.mounted) this.setState({ enabled: Boolean(data?.enabled ?? data?.twoFactorEnabled), loading: false });
    } catch {
      if (this.mounted) this.setState({ loading: false });
    }
  }

  private async startSetup(): Promise<void> {
    this.setState({ busy: true, message: '', isError: false });
    try {
      const data = await this.auth.post(RouteConstants.SEGMENTS.TWO_FACTOR_SETUP, {});
      if (this.mounted) this.setState({ busy: false, setupSecret: String(data?.secret ?? data?.manualKey ?? data?.otpauthUrl ?? ''), recoveryCodes: Array.isArray(data?.recoveryCodes) ? data.recoveryCodes : [] });
    } catch (error: any) {
      if (this.mounted) this.setState({ busy: false, isError: true, message: AccountAuthClient.errorMessage(error, this.t('account.twoFactor.failed')) });
    }
  }

  private async verify(): Promise<void> {
    if (!this.state.token) return;
    this.setState({ busy: true, message: '', isError: false });
    try {
      await this.auth.post(RouteConstants.SEGMENTS.TWO_FACTOR_VERIFY, { token: this.state.token });
      if (this.mounted) this.setState({ busy: false, enabled: true, setupSecret: '', token: '', isError: false, message: this.t('account.twoFactor.enabledMsg') });
    } catch (error: any) {
      if (this.mounted) this.setState({ busy: false, isError: true, message: AccountAuthClient.errorMessage(error, this.t('account.twoFactor.invalidToken')) });
    }
  }

  private async disable(): Promise<void> {
    this.setState({ busy: true, message: '', isError: false });
    try {
      await this.auth.delete(RouteConstants.SEGMENTS.TWO_FACTOR_DISABLE);
      if (this.mounted) this.setState({ busy: false, enabled: false, message: this.t('account.twoFactor.disabledMsg'), isError: false });
    } catch (error: any) {
      if (this.mounted) this.setState({ busy: false, isError: true, message: AccountAuthClient.errorMessage(error, this.t('account.twoFactor.failed')) });
    }
  }

  render(): React.ReactNode {
    const { loading, busy, enabled, setupSecret, recoveryCodes, token, message, isError } = this.state;
    const card: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' };
    const btn = (bg: string, fg: string): React.CSSProperties => ({ padding: '10px 22px', background: bg, color: fg, border: 'none', borderRadius: '999px', fontSize: '14px', fontWeight: 600, cursor: busy ? 'default' : 'pointer' });
    if (loading) return <div style={card}>{this.t('account.twoFactor.loading')}</div>;
    return (
      <div style={card}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 8px' }}>{this.t('account.section.two-factor')}</h2>
        <p style={{ color: '#475569', fontSize: '14px', margin: '0 0 16px' }}>
          {enabled ? this.t('account.twoFactor.on') : this.t('account.twoFactor.off')}
        </p>
        {message ? <p style={{ color: isError ? '#dc2626' : '#16a34a', fontSize: '13px' }}>{message}</p> : null}

        {enabled ? (
          <button onClick={() => void this.disable()} disabled={busy} style={btn('#fee2e2', '#b91c1c')}>{this.t('account.twoFactor.disable')}</button>
        ) : setupSecret ? (
          <div>
            <p style={{ fontSize: '13px', color: '#475569' }}>{this.t('account.twoFactor.scanKey')}</p>
            <code style={{ display: 'block', wordBreak: 'break-all', background: '#f8fafc', padding: '10px', borderRadius: '8px', fontSize: '12px', margin: '8px 0' }}>{setupSecret}</code>
            {recoveryCodes.length ? (
              <div style={{ margin: '8px 0' }}>
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>{this.t('account.twoFactor.recoveryCodes')}</div>
                <code style={{ display: 'block', background: '#f8fafc', padding: '10px', borderRadius: '8px', fontSize: '12px' }}>{recoveryCodes.join('  ')}</code>
              </div>
            ) : null}
            <input value={token} onChange={(e) => this.setState({ token: e.target.value })} placeholder={this.t('account.twoFactor.tokenPlaceholder')} style={{ padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', marginRight: '8px' }} />
            <button onClick={() => void this.verify()} disabled={busy} style={btn('#1a1a2e', '#fff')}>{this.t('account.twoFactor.verify')}</button>
          </div>
        ) : (
          <button onClick={() => void this.startSetup()} disabled={busy} style={btn('#1a1a2e', '#fff')}>{this.t('account.twoFactor.enable')}</button>
        )}
      </div>
    );
  }
}

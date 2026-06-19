import React from 'react';
import { RouteConstants } from '@fromcode119/core/client';
import { PluginComponent } from '../plugin-component';
import { AccountAuthClient } from './auth-client';

interface AccountSecurityPanelState {
  currentPassword: string;
  newPassword: string;
  saving: boolean;
  message: string;
  isError: boolean;
}

/** Plugin-owned default Security section for the framework AccountShell. Lets the signed-in user
 * change their password via the framework auth API (CSRF-protected). Registered into `account.panels`. */
export class AccountSecurityPanel extends PluginComponent<Record<string, unknown>, AccountSecurityPanelState> {
  static readonly accountSection = { key: 'security', labelKey: 'account.section.security', priority: 60 };

  private mounted = false;

  state: AccountSecurityPanelState = { currentPassword: '', newPassword: '', saving: false, message: '', isError: false };

  componentDidMount(): void { this.mounted = true; }
  componentWillUnmount(): void { this.mounted = false; }

  private async submit(): Promise<void> {
    if (!this.state.currentPassword || !this.state.newPassword) return;
    this.setState({ saving: true, message: '', isError: false });
    try {
      await AccountAuthClient.of(this.api).post(RouteConstants.SEGMENTS.CHANGE_PASSWORD, { currentPassword: this.state.currentPassword, newPassword: this.state.newPassword });
      if (this.mounted) this.setState({ saving: false, isError: false, message: this.t('account.security.changed'), currentPassword: '', newPassword: '' });
    } catch (error: any) {
      if (this.mounted) this.setState({ saving: false, isError: true, message: AccountAuthClient.errorMessage(error, this.t('account.security.failed')) });
    }
  }

  private input(key: 'currentPassword' | 'newPassword', labelKey: string): React.ReactNode {
    const inputStyle: React.CSSProperties = { display: 'block', width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', boxSizing: 'border-box', marginTop: '4px' };
    return (
      <label style={{ display: 'block', marginBottom: '14px', fontSize: '13px', color: '#475569' }}>
        {this.t(labelKey)}
        <input type="password" autoComplete={key === 'newPassword' ? 'new-password' : 'current-password'} value={this.state[key]} onChange={(e) => this.setState({ [key]: e.target.value } as any)} style={inputStyle} />
      </label>
    );
  }

  render(): React.ReactNode {
    const { saving, message, isError } = this.state;
    const card: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' };
    return (
      <div style={card}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 18px' }}>{this.t('account.section.security')}</h2>
        <form onSubmit={(e) => { e.preventDefault(); void this.submit(); }} style={{ maxWidth: '420px' }}>
          {/* Hidden username field for password-manager / accessibility (browsers warn without one). */}
          <input type="text" name="username" autoComplete="username" aria-hidden="true" tabIndex={-1} readOnly value="" style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0 0 0 0)', border: 0 }} />
          {this.input('currentPassword', 'account.security.current')}
          {this.input('newPassword', 'account.security.new')}
          {message ? <p style={{ color: isError ? '#dc2626' : '#16a34a', fontSize: '13px', margin: '0 0 12px' }}>{message}</p> : null}
          <button type="submit" disabled={saving} style={{ padding: '10px 22px', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: '999px', fontSize: '14px', fontWeight: 600, cursor: saving ? 'default' : 'pointer' }}>
            {saving ? this.t('account.security.saving') : this.t('account.security.change')}
          </button>
        </form>
      </div>
    );
  }
}

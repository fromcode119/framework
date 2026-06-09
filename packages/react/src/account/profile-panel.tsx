import React from 'react';
import { RouteConstants } from '@fromcode119/core/client';
import { PluginComponent } from '../plugin-component';
import { AccountAuthClient } from './auth-client';

interface AccountProfilePanelState {
  loading: boolean;
  saving: boolean;
  saved: boolean;
  error: string;
  person: Record<string, any> | null;
}

export class AccountProfilePanel extends PluginComponent<Record<string, unknown>, AccountProfilePanelState> {
  static readonly accountSection = { key: 'profile', labelKey: 'account.section.profile', priority: 0 };

  private mounted = false;

  state: AccountProfilePanelState = { loading: true, saving: false, saved: false, error: '', person: null };

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
    } catch (error: any) {
      if (this.mounted) this.setState({ error: String(error?.message || error), loading: false });
    }
  }

  private setField(key: string, value: string): void {
    this.setState({ person: { ...(this.state.person || {}), [key]: value }, saved: false });
  }

  private async save(): Promise<void> {
    const p = this.state.person || {};
    this.setState({ saving: true, saved: false, error: '' });
    try {
      const res = await this.client.patch(RouteConstants.SEGMENTS.ME_PERSON, {
        firstName: p.firstName ?? '',
        lastName: p.lastName ?? '',
        birthDate: p.birthDate ?? '',
        phone: p.phone ?? '',
      });
      const person = res?.person ?? res?.data?.person ?? p;
      if (this.mounted) this.setState({ person, saving: false, saved: true });
    } catch (error: any) {
      if (this.mounted) this.setState({ error: String(error?.message || error), saving: false });
    }
  }

  private renderField(key: string, type: string): React.ReactNode {
    const p = this.state.person || {};
    const inputStyle: React.CSSProperties = {
      display: 'block', width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0',
      borderRadius: '10px', fontSize: '14px', boxSizing: 'border-box', marginTop: '4px',
    };
    return (
      <label style={{ display: 'block', marginBottom: '14px', fontSize: '13px', color: '#475569' }}>
        {this.t(`account.profile.${key}`)}
        <input
          type={type}
          value={String(p[key] ?? '')}
          onChange={(e) => this.setField(key, e.target.value)}
          style={inputStyle}
        />
      </label>
    );
  }

  render(): React.ReactNode {
    const { loading, saving, saved, error } = this.state;
    const cardStyle: React.CSSProperties = {
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    };
    if (loading) return <div style={cardStyle}>{this.t('account.profile.loading')}</div>;
    return (
      <div style={cardStyle}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 18px' }}>{this.t('account.profile.heading')}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          {this.renderField('firstName', 'text')}
          {this.renderField('lastName', 'text')}
          {this.renderField('birthDate', 'date')}
          {this.renderField('phone', 'tel')}
        </div>
        {error ? <p style={{ color: '#dc2626', fontSize: '13px', margin: '0 0 12px' }}>{error}</p> : null}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => void this.save()}
            disabled={saving}
            style={{
              padding: '10px 22px', background: '#1a1a2e', color: '#fff', border: 'none',
              borderRadius: '999px', fontSize: '14px', fontWeight: 600, cursor: saving ? 'default' : 'pointer',
            }}
          >
            {saving ? this.t('account.profile.saving') : this.t('account.profile.save')}
          </button>
          {saved ? <span style={{ color: '#16a34a', fontSize: '13px' }}>✓ {this.t('account.profile.saved')}</span> : null}
        </div>
      </div>
    );
  }
}

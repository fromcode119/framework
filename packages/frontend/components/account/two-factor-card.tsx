import React from 'react';

export class AccountTwoFactorCard extends React.Component<{
  isEnabled?: boolean;
  onToggle?: () => void;
  isDark?: boolean;
}> {
  render(): React.ReactNode {
    return (
      <div style={{ padding: '24px', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
        <h3 style={{ fontWeight: 700, marginBottom: '8px' }}>Two-Factor Authentication</h3>
        <p style={{ color: '#64748b', fontSize: '14px' }}>
          {this.props.isEnabled ? 'Enabled' : 'Disabled'}
        </p>
      </div>
    );
  }
}

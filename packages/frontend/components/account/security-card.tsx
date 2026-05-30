import React from 'react';

export class AccountSecurityCard extends React.Component<{
  onChangePassword?: () => void;
  isDark?: boolean;
  [key: string]: any;
}> {
  render(): React.ReactNode {
    return (
      <div style={{ padding: '24px', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
        <h3 style={{ fontWeight: 700, marginBottom: '16px' }}>Security</h3>
        <p style={{ color: '#64748b', fontSize: '14px' }}>Manage your password and account security.</p>
      </div>
    );
  }
}

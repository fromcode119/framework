import React from 'react';

export class AccountOverviewPanel extends React.Component<{
  user?: any;
  isDark?: boolean;
  bgColor?: string;
  borderColor?: string;
  [key: string]: any;
}> {
  render(): React.ReactNode {
    return (
      <div style={{ padding: '24px', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
        <h2 style={{ fontWeight: 700, marginBottom: '16px' }}>Account Settings</h2>
        <p style={{ color: '#64748b', fontSize: '14px' }}>Manage your profile, security, and sessions.</p>
      </div>
    );
  }
}

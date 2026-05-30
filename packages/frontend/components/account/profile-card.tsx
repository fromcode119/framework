import React from 'react';

export class AccountProfileCard extends React.Component<{
  profile?: any;
  user?: any;
  onSave?: (data: any) => void;
  isDark?: boolean;
}> {
  render(): React.ReactNode {
    const user = this.props.profile || this.props.user;
    return (
      <div style={{ padding: '24px', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
        <h3 style={{ fontWeight: 700, marginBottom: '16px' }}>Profile</h3>
        <p><strong>Name:</strong> {String(user?.firstName || user?.name || '—')}</p>
        <p style={{ marginTop: '8px' }}><strong>Email:</strong> {String(user?.email || '—')}</p>
      </div>
    );
  }
}

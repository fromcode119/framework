import React from 'react';

export class AccountDashboard extends React.Component<{ user?: any; children?: React.ReactNode }> {
  render(): React.ReactNode {
    const { user } = this.props;
    return (
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '40px 24px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '8px' }}>
          {user?.name ? `Welcome, ${user.name}` : 'My Account'}
        </h1>
        <p style={{ color: '#64748b' }}>{user?.email || ''}</p>
        <div style={{ marginTop: '32px' }}>{this.props.children}</div>
      </div>
    );
  }
}

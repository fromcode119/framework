import React from 'react';

export class AccountDashboardHero extends React.Component<{ user?: any; isDark?: boolean }> {
  render(): React.ReactNode {
    const { user } = this.props;
    return (
      <div style={{ padding: '48px 24px', background: '#f8fafc' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900 }}>
          {user?.firstName ? `Hello, ${user.firstName}` : user?.name ? `Hello, ${user.name}` : 'My Account'}
        </h1>
        {user?.email && <p style={{ color: '#64748b', marginTop: '8px' }}>{user.email}</p>}
      </div>
    );
  }
}

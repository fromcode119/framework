import type { ReactNode } from 'react';

import { Reactor, prop } from '@fromcode119/reactor';

export class AccountDashboardHero extends Reactor {
  @prop declare user?: any;
  @prop declare isDark?: boolean;

  render(): ReactNode {
    const user = this.user;
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

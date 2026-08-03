import type { ReactNode } from 'react';

import { Reactor, prop } from '@fromcode119/reactor';

export class AccountSecurityCard extends Reactor {
  @prop declare onChangePassword?: () => void;
  @prop declare isDark?: boolean;

  render(): ReactNode {
    return (
      <div style={{ padding: '24px', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
        <h3 style={{ fontWeight: 700, marginBottom: '16px' }}>Security</h3>
        <p style={{ color: '#64748b', fontSize: '14px' }}>Manage your password and account security.</p>
      </div>
    );
  }
}

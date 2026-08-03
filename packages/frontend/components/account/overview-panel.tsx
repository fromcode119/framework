import type { ReactNode } from 'react';

import { Reactor, prop } from '@fromcode119/reactor';

export class AccountOverviewPanel extends Reactor {
  @prop declare user?: any;
  @prop declare isDark?: boolean;
  @prop declare bgColor?: string;
  @prop declare borderColor?: string;

  render(): ReactNode {
    return (
      <div style={{ padding: '24px', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
        <h2 style={{ fontWeight: 700, marginBottom: '16px' }}>Account Settings</h2>
        <p style={{ color: '#64748b', fontSize: '14px' }}>Manage your profile, security, and sessions.</p>
      </div>
    );
  }
}

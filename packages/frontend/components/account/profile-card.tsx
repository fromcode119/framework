import type { ReactNode } from 'react';

import { Reactor, prop } from '@fromcode119/reactor';

export class AccountProfileCard extends Reactor {
  @prop declare profile?: any;
  @prop declare user?: any;
  @prop declare onSave?: (data: any) => void;
  @prop declare isDark?: boolean;

  render(): ReactNode {
    const user = this.profile || this.user;
    return (
      <div style={{ padding: '24px', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
        <h3 style={{ fontWeight: 700, marginBottom: '16px' }}>Profile</h3>
        <p><strong>Name:</strong> {String(user?.firstName || user?.name || '—')}</p>
        <p style={{ marginTop: '8px' }}><strong>Email:</strong> {String(user?.email || '—')}</p>
      </div>
    );
  }
}

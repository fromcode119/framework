import type { ReactNode } from 'react';

import { Reactor, prop } from '@fromcode119/reactor';

export class AccountSessionCard extends Reactor {
  @prop declare sessions?: any[];
  @prop declare onRevoke?: (id: string) => void;
  @prop declare isDark?: boolean;

  render(): ReactNode {
    const sessions = this.sessions ?? [];
    return (
      <div style={{ padding: '24px', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
        <h3 style={{ fontWeight: 700, marginBottom: '16px' }}>Active Sessions</h3>
        {sessions.map((s: any, i: number) => (
          <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid #e2e8f0' }}>
            <p style={{ fontSize: '14px' }}>{String(s?.device || 'Unknown device')}</p>
          </div>
        ))}
        {sessions.length === 0 && <p style={{ color: '#64748b', fontSize: '14px' }}>No active sessions.</p>}
      </div>
    );
  }
}

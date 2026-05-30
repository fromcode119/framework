import React from 'react';

export class AccountSessionCard extends React.Component<{
  sessions?: any[];
  onRevoke?: (id: string) => void;
  isDark?: boolean;
}> {
  render(): React.ReactNode {
    const { sessions = [] } = this.props;
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

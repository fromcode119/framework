import React from 'react';

export class AccountOrdersPanel extends React.Component<{ orders?: any[]; isDark?: boolean }> {
  render(): React.ReactNode {
    const { orders = [] } = this.props;
    return (
      <div style={{ padding: '24px', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
        <h2 style={{ fontWeight: 700, marginBottom: '16px' }}>Order History</h2>
        {orders.length === 0 && <p style={{ color: '#64748b' }}>No orders yet.</p>}
        {orders.map((order: any, i: number) => (
          <div key={i} style={{ borderBottom: '1px solid #e2e8f0', padding: '12px 0' }}>
            <p style={{ fontWeight: 600 }}>Order #{String(order?.id || order?.orderNumber || '')}</p>
            <p style={{ color: '#64748b', fontSize: '14px' }}>{String(order?.createdAt || '')}</p>
          </div>
        ))}
      </div>
    );
  }
}

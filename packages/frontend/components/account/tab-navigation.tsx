import React from 'react';

export class AccountTabNavigation extends React.Component<{
  tabs?: Array<{ id: string; label: string }> | string[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
  isDark?: boolean;
}> {
  render(): React.ReactNode {
    const { tabs = [], activeTab, onTabChange } = this.props;
    return (
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e2e8f0', marginBottom: '24px' }}>
        {tabs.map((tab: any) => {
          const id = typeof tab === 'string' ? tab : tab.id;
          const label = typeof tab === 'string' ? tab : tab.label;
          return (
            <button
              key={id}
              onClick={() => onTabChange?.(id)}
              style={{
                padding: '10px 20px',
                border: 'none',
                borderBottom: activeTab === id ? '2px solid #1a1a1a' : '2px solid transparent',
                background: 'none',
                fontWeight: activeTab === id ? 700 : 400,
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
    );
  }
}

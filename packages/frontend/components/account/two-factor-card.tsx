import type { ReactNode } from 'react';

import { PureReactor, prop } from '@fromcode119/reactor';

export class AccountTwoFactorCard extends PureReactor {
  @prop declare isEnabled?: boolean;
  @prop declare onToggle?: () => void;
  @prop declare isDark?: boolean;

  render(): ReactNode {
    return (
      <div style={{ padding: '24px', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
        <h3 style={{ fontWeight: 700, marginBottom: '8px' }}>Two-Factor Authentication</h3>
        <p style={{ color: '#64748b', fontSize: '14px' }}>
          {this.isEnabled ? 'Enabled' : 'Disabled'}
        </p>
      </div>
    );
  }
}

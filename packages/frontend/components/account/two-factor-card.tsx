import { FrontendCopy } from '@/lib/i18n/frontend-copy';
import type { ReactNode } from 'react';

import { PureReactor, prop } from '@fromcode119/react-class-components';

export class AccountTwoFactorCard extends PureReactor {
  /** The page's locale, resolved on the server; the document's `lang` when a view renders only in the browser. */
  @prop declare locale?: string;
  @prop declare isEnabled?: boolean;
  @prop declare onToggle?: () => void;
  @prop declare isDark?: boolean;

  render(): ReactNode {
    return (
      <div style={{ padding: '24px', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
        <h3 style={{ fontWeight: 700, marginBottom: '8px' }}>{FrontendCopy.t(this.locale, 'frontend.twoFactorCard.twoFactorAuthentication')}</h3>
        <p style={{ color: '#64748b', fontSize: '14px' }}>
          {this.isEnabled ? FrontendCopy.t(this.locale, 'frontend.twoFactorCard.enabled') : FrontendCopy.t(this.locale, 'frontend.twoFactorCard.disabled')}
        </p>
      </div>
    );
  }
}

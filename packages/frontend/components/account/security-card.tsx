import { FrontendCopy } from '@/lib/i18n/frontend-copy';
import type { ReactNode } from 'react';

import { Reactor, prop } from '@fromcode119/react-class-components';

export class AccountSecurityCard extends Reactor {
  /** The page's locale, resolved on the server; the document's `lang` when a view renders only in the browser. */
  @prop declare locale?: string;
  @prop declare onChangePassword?: () => void;
  @prop declare isDark?: boolean;

  render(): ReactNode {
    return (
      <div style={{ padding: '24px', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
        <h3 style={{ fontWeight: 700, marginBottom: '16px' }}>{FrontendCopy.t(this.locale, 'frontend.securityCard.security')}</h3>
        <p style={{ color: '#64748b', fontSize: '14px' }}>{FrontendCopy.t(this.locale, 'frontend.securityCard.manageYourPasswordAndAccount')}</p>
      </div>
    );
  }
}

import { FrontendCopy } from '@/lib/i18n/frontend-copy';
import type { ReactNode } from 'react';

import { Reactor, prop } from '@fromcode119/react-class-components';

export class AccountOverviewPanel extends Reactor {
  /** The page's locale, resolved on the server; the document's `lang` when a view renders only in the browser. */
  @prop declare locale?: string;
  @prop declare user?: any;
  @prop declare isDark?: boolean;
  @prop declare bgColor?: string;
  @prop declare borderColor?: string;

  render(): ReactNode {
    return (
      <div style={{ padding: '24px', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
        <h2 style={{ fontWeight: 700, marginBottom: '16px' }}>{FrontendCopy.t(this.locale, 'frontend.overviewPanel.accountSettings')}</h2>
        <p style={{ color: '#64748b', fontSize: '14px' }}>{FrontendCopy.t(this.locale, 'frontend.overviewPanel.manageYourProfileSecurityAnd')}</p>
      </div>
    );
  }
}

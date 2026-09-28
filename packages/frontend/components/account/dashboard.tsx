import { FrontendCopy } from '@/lib/i18n/frontend-copy';
import type { ReactNode } from 'react';

import { Reactor, prop } from '@fromcode119/react-class-components';

export class AccountDashboard extends Reactor {
  /** The page's locale, resolved on the server; the document's `lang` when a view renders only in the browser. */
  @prop declare locale?: string;
  @prop declare user?: any;
  @prop declare children?: ReactNode;

  render(): ReactNode {
    const { user } = this;
    return (
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '40px 24px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '8px' }}>
          {user?.name ? `Welcome, ${user.name}` : FrontendCopy.t(this.locale, 'frontend.dashboard.myAccount')}
        </h1>
        <p style={{ color: '#64748b' }}>{user?.email || ''}</p>
        <div style={{ marginTop: '32px' }}>{this.children}</div>
      </div>
    );
  }
}

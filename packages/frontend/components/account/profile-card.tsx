import { FrontendCopy } from '@/lib/i18n/frontend-copy';
import type { ReactNode } from 'react';

import { Reactor, prop } from '@fromcode119/react-class-components';

export class AccountProfileCard extends Reactor {
  /** The page's locale, resolved on the server; the document's `lang` when a view renders only in the browser. */
  @prop declare locale?: string;
  @prop declare profile?: any;
  @prop declare user?: any;
  @prop declare onSave?: (data: any) => void;
  @prop declare isDark?: boolean;

  render(): ReactNode {
    const user = this.profile || this.user;
    return (
      <div style={{ padding: '24px', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
        <h3 style={{ fontWeight: 700, marginBottom: '16px' }}>{FrontendCopy.t(this.locale, 'frontend.profileCard.profile')}</h3>
        <p><strong>{FrontendCopy.t(this.locale, 'frontend.profileCard.name')}</strong> {String(user?.firstName || user?.name || '—')}</p>
        <p style={{ marginTop: '8px' }}><strong>{FrontendCopy.t(this.locale, 'frontend.profileCard.email')}</strong> {String(user?.email || '—')}</p>
      </div>
    );
  }
}

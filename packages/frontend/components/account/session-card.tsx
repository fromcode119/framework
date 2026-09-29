import { FrontendCopy } from '@/lib/i18n/frontend-copy';
import type { ReactNode } from 'react';

import { Reactor, prop } from '@fromcode119/react-class-components';

export class AccountSessionCard extends Reactor {
  /** The page's locale, resolved on the server; the document's `lang` when a view renders only in the browser. */
  @prop declare locale?: string;
  @prop declare sessions?: any[];
  @prop declare onRevoke?: (id: string) => void;
  @prop declare isDark?: boolean;

  render(): ReactNode {
    const sessions = this.sessions ?? [];
    return (
      <div style={{ padding: '24px', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
        <h3 style={{ fontWeight: 700, marginBottom: '16px' }}>{FrontendCopy.t(this.locale, 'frontend.sessionCard.activeSessions')}</h3>
        {sessions.map((s: any, i: number) => (
          <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid #e2e8f0' }}>
            <p style={{ fontSize: '14px' }}>{String(s?.device || FrontendCopy.t(this.locale, 'frontend.sessionCard.unknownDevice'))}</p>
          </div>
        ))}
        {sessions.length === 0 && <p style={{ color: '#64748b', fontSize: '14px' }}>{FrontendCopy.t(this.locale, 'frontend.sessionCard.noActiveSessions')}</p>}
      </div>
    );
  }
}

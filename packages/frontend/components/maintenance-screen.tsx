import { FrontendCopy } from '@/lib/i18n/frontend-copy';

import { PureReactor, prop } from '@fromcode119/react-class-components';

export class MaintenanceScreen extends PureReactor {
  /** The page's locale, resolved on the server; the document's `lang` when a view renders only in the browser. */
  @prop declare locale?: string;
  render() {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#fff',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '20px',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{ color: '#6366f1', marginBottom: '20px' }}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
          </svg>
        </div>
        <h1 style={{ fontSize: '24px', fontWeight: '900', marginBottom: '10px' }}>{FrontendCopy.t(this.locale, 'frontend.maintenanceScreen.systemMaintenance')}</h1>
        <p style={{ color: '#64748b', maxWidth: '400px', lineHeight: '1.6' }}>
          {FrontendCopy.t(this.locale, 'frontend.maintenanceScreen.weAreCurrentlyPerformingScheduled')}
        </p>
      </div>
    );
  }
}

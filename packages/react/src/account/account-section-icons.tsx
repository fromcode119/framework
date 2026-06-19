import React from 'react';

/**
 * Inline SVG glyphs for the AccountShell section nav, keyed by section `key`. Inline (not an icon font
 * or external dependency) so the framework default account renders standalone. `currentColor` lets the
 * nav link's active/hover colour drive the icon. Unknown keys fall back to a neutral dot.
 */
export class AccountSectionIcons {
  private static readonly PATHS: Record<string, React.ReactNode> = {
    overview: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></>,
    profile: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.5-6 8-6s8 2 8 6" /></>,
    orders: <><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></>,
    subscription: <><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" /></>,
    courses: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /></>,
    materials: <><path d="M4 5a2 2 0 0 1 2-2h4l2 3h6a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" /></>,
    newsletter: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
    affiliate: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.3 2.9-5 6.5-5s6.5 1.7 6.5 5" /><path d="M17 9.5a3 3 0 0 0 0-3" /><path d="M19.5 20c0-2.4-1.2-3.9-3-4.6" /></>,
    security: <><path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6Z" /><path d="m9 12 2 2 4-4" /></>,
    sessions: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8" /><path d="M12 16v4" /></>,
    'two-factor': <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  };

  static for(key: string): React.ReactNode {
    const inner = AccountSectionIcons.PATHS[String(key || '').toLowerCase()]
      || <circle cx="12" cy="12" r="3.5" />;
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {inner}
      </svg>
    );
  }
}

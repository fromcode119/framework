import type { ReactNode } from 'react';

/**
 * Inline SVG glyphs for the AccountShell section nav.
 *
 * The framework only knows its OWN sections — overview, profile, security, sessions, two-factor. A
 * plugin's section ships its own glyph in its `accountSection` descriptor (`icon`), as bare SVG children
 * that {@link AccountSectionIcons.wrap} places inside the shared `<svg>`, so every icon inherits the same
 * size, stroke and `currentColor`. Keeping a map of orders/courses/affiliate/… here would be the
 * framework naming other plugins' keys, and it silently gave every section the framework had not been
 * told about (addresses, downloads) the fallback dot.
 *
 * Inline (not an icon font or external dependency) so the framework default account renders standalone.
 */
export class AccountSectionIcons {
  private static readonly FRAMEWORK_PATHS: Record<string, ReactNode> = {
    overview: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></>,
    profile: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.5-6 8-6s8 2 8 6" /></>,
    security: <><path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6Z" /><path d="m9 12 2 2 4-4" /></>,
    sessions: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8" /><path d="M12 16v4" /></>,
    'two-factor': <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  };

  /** A neutral glyph for a section that shipped no icon of its own. */
  private static readonly FALLBACK: ReactNode = <><circle cx="12" cy="12" r="9" /><path d="M12 8v4l2.5 2.5" /></>;

  /** The section's own icon when it has one, else the framework glyph for a framework section. */
  static for(key: string, icon?: ReactNode): ReactNode {
    if (icon) return AccountSectionIcons.wrap(icon);
    return AccountSectionIcons.wrap(
      AccountSectionIcons.FRAMEWORK_PATHS[String(key || '').toLowerCase()] || AccountSectionIcons.FALLBACK,
    );
  }

  /** The shared `<svg>` frame — 24×24, `currentColor`, so the nav link's colour drives the glyph. */
  static wrap(inner: ReactNode): ReactNode {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {inner}
      </svg>
    );
  }
}

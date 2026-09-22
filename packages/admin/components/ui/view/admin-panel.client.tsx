import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';

/**
 * One panel on a record screen: a titled card with an optional icon, a line of explanation and an
 * action in the top-right.
 *
 * It exists because every plugin that wanted one built its own, and they drifted. On a single order
 * screen there were four: `rounded-2xl p-4`, `rounded-2xl p-5`, `rounded-3xl p-5` and
 * `rounded-xl p-4`; titles at 16px semibold, at 12px uppercase indigo, and at 12px uppercase slate
 * with 0.22em tracking; two of them with a 44px filled icon tile in different colours and corner
 * radii, the others with no icon at all. Nothing was wrong with any one of them — together they read
 * as four unrelated products stacked down one page.
 *
 * It lives in the framework rather than in a plugin because the panels that need it belong to
 * DIFFERENT plugins, and a plugin may not import another plugin's components.
 *
 * The icon is a small inline glyph, not a filled tile: a 44px coloured badge is the weight of a
 * primary action, and these are headings.
 */
export class AdminPanel extends PureReactor {
  @prop declare title: string;
  @prop declare description?: string;
  @prop declare icon?: ReactNode;
  /** Rendered top-right, aligned with the TITLE — not centred against the panel's full height. */
  @prop declare actions?: ReactNode;
  @prop declare children?: ReactNode;
  @prop declare className?: string;

  render(): ReactNode {
    const { title, description, icon, actions, children } = this;

    return (
      <div className={`mb-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 ${this.className ?? ''}`}>
        <div className={`flex items-start justify-between gap-5 ${children ? 'mb-3.5' : ''}`}>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[12px] font-bold tracking-[0.02em] text-slate-800 dark:text-slate-100">
              {icon ? <span className="shrink-0 text-slate-500 dark:text-slate-400">{icon}</span> : null}
              {title}
            </div>
            {description ? (
              <p className="mt-1 max-w-[60ch] text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap justify-end gap-2">{actions}</div> : null}
        </div>
        {children}
      </div>
    );
  }
}

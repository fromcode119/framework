import { Children } from 'react';
import type { ReactNode } from 'react';
import { Reactor, prop, state, bound } from '@fromcode119/react-class-components';
import { FieldHelpButton } from '@/components/collection/view/field-help-button.client';

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
export class AdminPanel extends Reactor {
  @prop declare title: string;
  @prop declare description?: string;
  @prop declare icon?: ReactNode;
  /** Rendered top-right, aligned with the TITLE — not centred against the panel's full height. */
  @prop declare actions?: ReactNode;
  @prop declare children?: ReactNode;
  @prop declare className?: string;

  /** An action-only panel keeps its explanation behind the help control; this is that control's state. */
  @state helpOpen = false;

  @bound private toggleHelp(): void {
    this.helpOpen = !this.helpOpen;
  }

  /**
   * Whether the panel holds content of its own. A panel that only ever renders a dialog passes
   * `[null, null]` while the dialog is closed, which is an array and so truthy — count what would
   * actually be drawn.
   */
  private get hasBody(): boolean {
    return Children.toArray(this.children).length > 0;
  }

  /**
   * A title and an action: one line. Its description says what the button does, which is read once,
   * so it waits behind the help control like a field's does — printed, it made a one-button panel
   * three lines tall, and four of those stood between the header and the first field of a record.
   */
  private renderAction(): ReactNode {
    const { title, description, icon, actions } = this;
    return (
      <div className={`fc-admin-panel mb-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 dark:border-slate-700 dark:bg-slate-900 ${this.className ?? ''}`}>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 items-center gap-1.5 text-[12px] font-bold tracking-[0.02em] text-slate-800 dark:text-slate-100">
            {icon ? <span className="shrink-0 text-slate-500 dark:text-slate-400">{icon}</span> : null}
            <span className="min-w-0">{title}</span>
            {description ? <FieldHelpButton label={title} open={this.helpOpen} onToggle={this.toggleHelp} /> : null}
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-2">{actions}</div>
        </div>
        {this.helpOpen && description ? <p className="mt-1.5 max-w-[60ch] text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">{description}</p> : null}
        {this.children}
      </div>
    );
  }

  render(): ReactNode {
    const { title, description, icon, actions, children } = this;
    if (!this.hasBody && actions) return this.renderAction();

    return (
      <div className={`fc-admin-panel fc-admin-panel--body mb-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 ${this.className ?? ''}`}>
        <div className={`flex items-start justify-between gap-5 ${this.hasBody ? 'mb-3' : ''}`}>
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

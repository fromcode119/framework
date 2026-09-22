import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';

/**
 * A field the operator may not edit, shown as a VALUE on the recessed surface — not as an input.
 *
 * A disabled input still looks like an input: a white box with a border, sized for typing, sitting in
 * a column of boxes you CAN type into. The only thing separating them was that one ignored the
 * cursor. So a tracking number the courier writes looked exactly like a field nobody had filled in
 * yet, and the emptiest ones read as work outstanding.
 *
 * This is the same treatment `AdminFactGrid` gives recorded values, for the same reason: on this
 * screen, recessed grey means "this was recorded", and white means "you can type here". The label and
 * the unlock control stay in the field header above, so nothing is repeated here.
 */
export class ReadOnlyFieldValue extends PureReactor {
  @prop declare value?: unknown;
  /** Shown when there is no value — never an "Enter…" prompt, which is an instruction you cannot follow. */
  @prop declare emptyLabel?: string;
  /**
   * WHO writes this value, shown in the lock bar rather than as a description line below the field.
   *
   * It is the same sentence either way, but under the field it reads as a footnote about a control,
   * and in the bar it reads as the reason the control is not one. Moving it also removes a row rather
   * than adding one: the field's description line is suppressed when it appears here.
   */
  @prop declare provenance?: string;

  private get text(): string {
    const { value } = this;
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return '';
  }

  render(): ReactNode {
    const text = this.text.trim();
    const empty = !text;
    const provenance = (this.provenance || '').trim();

    const valueClass = `text-[12.5px] leading-snug ${
      empty ? 'text-slate-400 dark:text-slate-500' : 'font-medium text-slate-600 dark:text-slate-300'
    }`;

    if (!provenance) {
      return (
        <div className="min-h-[34px] rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-950/40">
          <span className={valueClass}>{empty ? (this.emptyLabel || 'Not set') : text}</span>
        </div>
      );
    }

    return (
      <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-1.5 dark:border-slate-700 dark:bg-slate-900">
          <FrameworkIcons.Lock size={11} className="shrink-0 text-slate-400 dark:text-slate-500" />
          <p className="text-[10px] font-semibold leading-relaxed text-slate-500 dark:text-slate-400">{provenance}</p>
        </div>
        <div className="min-h-[34px] bg-slate-50 px-3 py-2 dark:bg-slate-950/40">
          <span className={valueClass}>{empty ? (this.emptyLabel || 'Not set') : text}</span>
        </div>
      </div>
    );
  }
}

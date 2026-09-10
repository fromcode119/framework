import type { MouseEvent, ReactNode } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';

/**
 * The admin's tick box.
 *
 * Extracted because this markup existed verbatim in three places — the data-table row, the table's
 * select-all header, and the media card — and a fourth was about to be written for the media list view.
 *
 * ## Why a button, not a `<label>` wrapping a hidden `<input>`
 *
 * The label form double-fires inside a clickable ancestor: clicking the box activates the nested input,
 * whose synthetic click ALSO bubbles, so a parent `onClick` runs twice and the selection toggles back
 * off. In the data table that made the tick look broken — it only worked when you clicked the cell
 * padding *outside* the box, which is exactly one click.
 *
 * A single `<button role="checkbox">` fires once, is focusable, and answers space/enter for free. No
 * native input is involved, so nothing can double-activate.
 *
 * ## `presentational`
 *
 * Some call sites already own the click on an ancestor because they need the event itself — the table
 * row uses it for shift-range select. Those pass `presentational`, which renders the same box with no
 * handler of its own, so the ancestor stays the single source of the toggle.
 */
export class Checkbox extends PureReactor {
  @prop declare checked: boolean;
  @prop declare onChange?: (checked: boolean, event?: MouseEvent) => void;
  /** Header state: some but not all children ticked. Renders a dash rather than a check. */
  @prop declare indeterminate?: boolean;
  @prop declare disabled?: boolean;
  @prop declare label?: ReactNode;
  @prop declare className?: string;
  /** Render the box only — an ancestor owns the click. See the note above. */
  @prop declare presentational?: boolean;

  @bound private handleClick(event: MouseEvent): void {
    if (this.disabled) return;
    // The box sits inside rows that have their own click behaviour (open the record, follow a link).
    // Ticking must not also trigger those.
    event.stopPropagation();
    this.onChange?.(!this.checked, event);
  }

  private get boxClass(): string {
    const active = this.checked || this.indeterminate;
    return `w-4 h-4 rounded border-2 transition-all flex items-center justify-center flex-shrink-0 ${
      active
        ? 'bg-indigo-600 border-indigo-600 shadow-lg shadow-indigo-600/20'
        : 'bg-white border-slate-300 dark:bg-slate-800 dark:border-slate-600'
    } ${this.disabled ? 'opacity-50' : ''}`;
  }

  private get mark(): ReactNode {
    if (this.checked) return <FrameworkIcons.Check size={10} className="text-white" strokeWidth={3} />;
    if (this.indeterminate) return <span className="w-2 h-0.5 bg-white rounded" />;
    return null;
  }

  render(): ReactNode {
    if (this.presentational) {
      return <span className={`${this.boxClass} ${this.className || ''}`}>{this.mark}</span>;
    }

    return (
      <button
        type="button"
        role="checkbox"
        aria-checked={this.indeterminate && !this.checked ? 'mixed' : Boolean(this.checked)}
        disabled={Boolean(this.disabled)}
        onClick={this.handleClick}
        // Generous target: the box is 16px, which is under every touch guideline. The padding is
        // negative-margined away so the extra hit area costs no layout.
        className={`inline-flex items-center gap-2 p-1.5 -m-1.5 ${this.disabled ? 'cursor-not-allowed' : 'cursor-pointer'} ${this.className || ''}`}
      >
        <span className={this.boxClass}>{this.mark}</span>
        {this.label ? <span className="text-[11px] select-none">{this.label}</span> : null}
      </button>
    );
  }
}

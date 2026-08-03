import type { ReactNode } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/reactor';

/**
 * Accessible on/off switch. Presentational → `PureReactor` (skips re-renders on unchanged props); props via
 * `@prop`, the toggle a `@bound` method passed by name — no hooks, no raw React.
 */
export class Switch extends PureReactor {
  @prop declare checked: boolean;
  @prop declare onChange: (checked: boolean) => void;
  @prop declare disabled?: boolean;
  @prop declare label?: string;
  @prop declare description?: string;

  @bound
  protected toggle(): void {
    this.onChange(!this.checked);
  }

  render(): ReactNode {
    const trackTone = this.disabled
      ? 'cursor-not-allowed opacity-50'
      : 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2';
    const trackFill = this.checked ? 'bg-slate-900 dark:bg-slate-100' : 'bg-slate-300 dark:bg-slate-700';
    return (
      <div className="flex items-center justify-between gap-3">
        {this.label || this.description ? (
          <div className="min-w-0">
            {this.label ? <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">{this.label}</p> : null}
            {this.description ? <p className="text-[11px] text-slate-500 dark:text-slate-400">{this.description}</p> : null}
          </div>
        ) : null}

        <button
          type="button"
          role="switch"
          aria-checked={this.checked}
          disabled={this.disabled}
          onClick={this.toggle}
          className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition ${trackTone} ${trackFill}`}
        >
          <span
            aria-hidden
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
              this.checked ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
    );
  }
}

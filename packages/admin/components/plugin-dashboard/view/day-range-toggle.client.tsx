import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';

/**
 * The single canonical date-range selector for every admin dashboard.
 * A clean segmented control — presets only. Keep the API stable (value/onChange/options)
 * so all consumers (plugin overviews + framework dashboards) stay visually consistent.
 */
export class DayRangeToggle extends PureReactor {
  @prop declare value: number;
  @prop declare onChange: (days: number) => void;
  @prop declare options?: number[];
  @prop declare label?: string;

  render(): ReactNode {
    const value = this.value;
    const onChange = this.onChange;
    const options = this.options ?? [7, 14, 30];
    const label = this.label ?? 'Range';
    return (
      <div className="inline-flex items-center gap-2">
        {label && (
          <span className="hidden sm:inline text-[11px] font-medium text-slate-400 dark:text-slate-500">
            {label}
          </span>
        )}
        {/* h-8 == Button size=SM. Without a fixed height this control sat ~30px next to a 32px small
            button, so any header pairing a range toggle with a button rendered visibly ragged. */}
        <div className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-800 dark:bg-slate-900/40">
          {options.map((days) => {
            const active = value === days;
            return (
              <button
                key={days}
                type="button"
                onClick={() => onChange(days)}
                aria-pressed={active}
                className={`inline-flex h-full items-center px-2.5 rounded-lg text-xs font-medium tabular-nums transition-colors ${
                  active
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                {days}d
              </button>
            );
          })}
        </div>
      </div>
    );
  }
}

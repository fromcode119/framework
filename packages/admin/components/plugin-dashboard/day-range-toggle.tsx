"use client";

import React from 'react';

interface DayRangeToggleProps {
  value: number;
  onChange: (days: number) => void;
  options?: number[];
  label?: string;
}

/**
 * The single canonical date-range selector for every admin dashboard.
 * A clean segmented control — presets only. Keep the API stable (value/onChange/options)
 * so all consumers (plugin overviews + framework dashboards) stay visually consistent.
 */
export class DayRangeToggle extends React.Component<DayRangeToggleProps> {
  render(): React.ReactNode {
    const { value, onChange, options = [7, 14, 30], label = 'Range' } = this.props;
    return (
      <div className="inline-flex items-center gap-2">
        {label && (
          <span className="hidden sm:inline text-[11px] font-medium text-slate-400 dark:text-slate-500">
            {label}
          </span>
        )}
        <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-800 dark:bg-slate-900/40">
          {options.map((days) => {
            const active = value === days;
            return (
              <button
                key={days}
                type="button"
                onClick={() => onChange(days)}
                aria-pressed={active}
                className={`px-2.5 py-1 rounded-md text-xs font-medium tabular-nums transition-colors ${
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

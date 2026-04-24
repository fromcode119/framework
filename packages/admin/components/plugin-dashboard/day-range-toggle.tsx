"use client";

import React from 'react';

interface DayRangeToggleProps {
  value: number;
  onChange: (days: number) => void;
  options?: number[];
  label?: string;
}

export const DayRangeToggle = ({
  value,
  onChange,
  options = [7, 14, 30],
  label = 'Range',
}: DayRangeToggleProps) => {
  return (
    <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900/40 p-1.5 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 shadow-sm">
      {label && (
        <span className="hidden sm:inline-block pl-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
          {label}
        </span>
      )}
      <div className="flex bg-white/50 dark:bg-slate-800/50 p-1 rounded-xl shadow-inner">
        {options.map((days) => (
          <button
            key={days}
            type="button"
            onClick={() => onChange(days)}
            className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tight transition-all duration-200 ${
              value === days
                ? 'bg-white dark:bg-slate-700 shadow-md text-indigo-600 dark:text-indigo-400 ring-1 ring-slate-100 dark:ring-slate-600'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {days}d
          </button>
        ))}
      </div>
    </div>
  );
};

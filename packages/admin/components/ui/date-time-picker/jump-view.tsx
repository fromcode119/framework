"use client";

import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import { DateTimePickerConstants } from './constants';

interface DateTimePickerJumpViewProps {
  theme: string;
  visibleMonth: Date;
  onShiftYear: (offset: number) => void;
  onJumpMonthSelect: (monthIndex: number) => void;
}

export class DateTimePickerJumpView extends React.Component<DateTimePickerJumpViewProps> {
  render(): React.ReactNode {
    const { theme, visibleMonth, onShiftYear, onJumpMonthSelect } = this.props;
    const currentVisibleYear = visibleMonth.getFullYear();

    return (
      <div className={`space-y-5 rounded-xl p-5 ${theme === 'dark' ? 'bg-slate-800/40 ring-1 ring-white/5' : 'bg-slate-50/80 ring-1 ring-black/5'}`}>
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => onShiftYear(-1)}
            className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-150 ${
              theme === 'dark'
                ? 'bg-slate-700/40 text-slate-300 hover:bg-indigo-500/20 hover:text-indigo-200 active:scale-95 ring-1 ring-white/5'
                : 'bg-white text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 active:scale-95 shadow-sm ring-1 ring-black/5'
            }`}
            aria-label="Previous year"
          >
            <FrameworkIcons.Left size={16} />
          </button>
          <div className="text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Jump to month</p>
            <p className={`mt-0.5 text-[17px] font-semibold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{currentVisibleYear}</p>
          </div>
          <button
            type="button"
            onClick={() => onShiftYear(1)}
            className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-150 ${
              theme === 'dark'
                ? 'bg-slate-700/40 text-slate-300 hover:bg-indigo-500/20 hover:text-indigo-200 active:scale-95 ring-1 ring-white/5'
                : 'bg-white text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 active:scale-95 shadow-sm ring-1 ring-black/5'
            }`}
            aria-label="Next year"
          >
            <FrameworkIcons.Right size={16} />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {DateTimePickerConstants.MONTH_LABELS.map((label, monthIndex) => {
            const isActive = visibleMonth.getMonth() === monthIndex;
            return (
              <button
                key={label}
                type="button"
                onClick={() => onJumpMonthSelect(monthIndex)}
                className={`rounded-xl px-4 py-2.5 text-[13px] font-semibold tracking-tight transition-all duration-150 ${
                  isActive
                    ? theme === 'dark'
                      ? 'bg-indigo-500 text-white shadow-xl shadow-indigo-500/30 ring-1 ring-indigo-400/50'
                      : 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/25 ring-1 ring-indigo-500/50'
                    : theme === 'dark'
                      ? 'bg-slate-700/40 text-slate-200 hover:bg-indigo-500/10 hover:text-indigo-300 active:scale-95 ring-1 ring-white/5'
                      : 'bg-white text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 active:scale-95 shadow-sm ring-1 ring-black/5'
                }`}
              >
                {label.slice(0, 3)}
              </button>
            );
          })}
        </div>
      </div>
    );
  }
}

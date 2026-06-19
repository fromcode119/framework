"use client";

import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import { Button } from '../button';

interface DateTimePickerFooterProps {
  theme: string;
  showTime: boolean;
  timezone: string;
  zonedParts: any;
  onTimeChange: (type: 'hours' | 'minutes', val: string) => void;
  onQuickAction: (dayOffset: number) => void;
  onClear: () => void;
  onClose: () => void;
}

export class DateTimePickerFooter extends React.Component<DateTimePickerFooterProps> {
  render(): React.ReactNode {
    const { theme, showTime, timezone, zonedParts, onTimeChange, onQuickAction, onClear, onClose } = this.props;

    return (
      <>
        {showTime && (
          <div className={`mt-6 pt-6 flex flex-col gap-5 ${theme === 'dark' ? 'border-t border-white/5' : 'border-t border-slate-200/80'}`}>
            <div className="flex items-center gap-3.5">
               <div className={`h-11 w-11 rounded-xl flex items-center justify-center shadow-sm transition-all duration-150 ${
                 theme === 'dark'
                   ? 'bg-indigo-500/10 text-indigo-300 ring-1 ring-indigo-400/20'
                   : 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-500/20'
               }`}>
                  <FrameworkIcons.Clock size={18} />
               </div>
               <div className="flex flex-col">
                  <span className={`text-[12px] font-semibold tracking-tight ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>Time Precision</span>
                  <span className="text-[11px] font-medium text-slate-400 tracking-tight">Timezone: {timezone}</span>
               </div>
            </div>

            <div className="flex items-center gap-3 justify-center">
              <div className="flex flex-col gap-2 w-20">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 text-center">Hour</span>
                <input
                  type="number"
                  min="0"
                  max="23"
                  value={zonedParts?.hour || 0}
                  onChange={(e) => onTimeChange('hours', e.target.value)}
                  className={`w-full h-12 rounded-xl text-center font-bold text-[15px] tracking-tight transition-all duration-150 outline-none ${
                    theme === 'dark'
                      ? 'bg-slate-800/60 text-white focus:bg-slate-700/60 focus:ring-2 focus:ring-indigo-400/50 ring-1 ring-white/5'
                      : 'bg-slate-50 text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500/50 shadow-inner ring-1 ring-black/5'
                  }`}
                />
              </div>
              <span className={`text-2xl font-bold pt-6 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-300'}`}>:</span>
              <div className="flex flex-col gap-2 w-20">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 text-center">Min</span>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={zonedParts?.minute || 0}
                  onChange={(e) => onTimeChange('minutes', e.target.value)}
                  className={`w-full h-12 rounded-xl text-center font-bold text-[15px] tracking-tight transition-all duration-150 outline-none ${
                    theme === 'dark'
                      ? 'bg-slate-800/60 text-white focus:bg-slate-700/60 focus:ring-2 focus:ring-indigo-400/50 ring-1 ring-white/5'
                      : 'bg-slate-50 text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500/50 shadow-inner ring-1 ring-black/5'
                  }`}
                />
              </div>
            </div>
          </div>
        )}

        <div className={`mt-6 pt-6 flex flex-col gap-3.5 ${theme === 'dark' ? 'border-t border-white/5' : 'border-t border-slate-200/80'}`}>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onQuickAction(0)}
              className={`rounded-xl px-4 py-2 text-[12px] font-semibold tracking-tight transition-all duration-150 ${
                theme === 'dark'
                  ? 'bg-slate-700/40 text-slate-200 hover:bg-indigo-500/10 hover:text-indigo-200 active:scale-95 ring-1 ring-white/5'
                  : 'bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 active:scale-95 ring-1 ring-black/5'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => onQuickAction(1)}
              className={`rounded-xl px-4 py-2 text-[12px] font-semibold tracking-tight transition-all duration-150 ${
                theme === 'dark'
                  ? 'bg-slate-700/40 text-slate-200 hover:bg-indigo-500/10 hover:text-indigo-200 active:scale-95 ring-1 ring-white/5'
                  : 'bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 active:scale-95 ring-1 ring-black/5'
              }`}
            >
              Tomorrow
            </button>
            <button
              type="button"
              onClick={onClear}
              className={`rounded-xl px-4 py-2 text-[12px] font-semibold tracking-tight transition-all duration-150 ${
                theme === 'dark'
                  ? 'bg-slate-700/40 text-slate-200 hover:bg-rose-500/10 hover:text-rose-300 active:scale-95 ring-1 ring-white/5'
                  : 'bg-slate-100 text-slate-700 hover:bg-rose-50 hover:text-rose-600 active:scale-95 ring-1 ring-black/5'
              }`}
            >
              Clear
            </button>
          </div>
          {showTime ? (
            <Button
              variant="primary"
              size="md"
              className="w-full rounded-xl font-semibold text-[13px] tracking-tight shadow-lg active:scale-[0.98] transition-all duration-150"
              onClick={onClose}
            >
              Apply Selection
            </Button>
          ) : null}
        </div>
      </>
    );
  }
}

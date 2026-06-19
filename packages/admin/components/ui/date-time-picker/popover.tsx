"use client";

import React from 'react';
import { DayPicker } from 'react-day-picker';
import { FrameworkIcons } from '@fromcode119/react';
import { RootFramework } from '@fromcode119/react';
import { TimezoneUtils } from '@/lib/timezone';
import { DateTimePickerConstants } from './constants';
import { DateTimePickerDayClassNames } from './day-classnames';
import { DateTimePickerJumpView } from './jump-view';
import { DateTimePickerFooter } from './footer';
import type { DateTimePickerPopoverProps } from './interfaces';

export class DateTimePickerPopover extends React.Component<DateTimePickerPopoverProps> {
  render(): React.ReactNode {
    const {
      theme, showTime, timezone, placeholder, value, coords, visibleMonth, isJumpViewOpen,
      utcDate, zonedParts, pickerDate, popoverRef,
      onJumpToSelected, onShiftMonth, onToggleJumpView, onShiftYear, onJumpMonthSelect,
      onSelect, onVisibleMonthChange, onTimeChange, onQuickAction, onClear, onClose,
    } = this.props;

    const selectedSummary = value && utcDate
      ? TimezoneUtils.formatSystemDate(
          utcDate,
          showTime ? { dateStyle: 'full', timeStyle: 'short' } : { dateStyle: 'full' },
          placeholder,
          timezone,
        )
      : 'No date selected';

    return (
        <RootFramework>
          <div
            ref={popoverRef}
            style={{
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              width: 'min(380px, calc(100vw - 32px))',
              maxWidth: 'calc(100vw - 32px)',
              zIndex: 9999
            }}
            className={`p-6 rounded-2xl animate-in zoom-in-95 slide-in-from-top-2 duration-200
              ${theme === 'dark'
                ? 'bg-slate-900/98 backdrop-blur-2xl shadow-2xl shadow-black/40 ring-1 ring-white/5'
                : 'bg-white/98 backdrop-blur-2xl shadow-2xl shadow-slate-950/10 ring-1 ring-black/5'}`}
          >
            <div className={`mb-5 flex flex-col gap-4 rounded-xl p-4 ${theme === 'dark' ? 'bg-slate-800/40 ring-1 ring-white/5' : 'bg-slate-50/80 ring-1 ring-black/5'}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                    Selected
                  </p>
                  <p className={`mt-0.5 truncate text-[15px] font-semibold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    {selectedSummary}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onJumpToSelected}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-semibold tracking-tight transition-all duration-150 ${
                    theme === 'dark'
                      ? 'text-indigo-300 hover:bg-indigo-500/10 hover:text-indigo-200 active:scale-95'
                      : 'text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 active:scale-95'
                  }`}
                >
                  {pickerDate ? 'Jump' : 'Today'}
                </button>
              </div>
              <div className="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => onShiftMonth(-1)}
                  className={`flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-150 ${
                    theme === 'dark'
                      ? 'bg-slate-700/40 text-slate-300 hover:bg-indigo-500/20 hover:text-indigo-200 active:scale-95 ring-1 ring-white/5'
                      : 'bg-white text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 active:scale-95 shadow-sm ring-1 ring-black/5'
                  }`}
                  aria-label="Previous month"
                >
                  <FrameworkIcons.Left size={18} />
                </button>
                <button
                  type="button"
                  onClick={onToggleJumpView}
                  className={`flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-semibold tracking-tight transition-all duration-150 ${
                    theme === 'dark'
                      ? 'bg-slate-700/40 text-white hover:bg-indigo-500/20 hover:text-indigo-100 active:scale-[0.98] ring-1 ring-white/5'
                      : 'bg-white text-slate-900 hover:bg-indigo-50 hover:text-indigo-700 active:scale-[0.98] shadow-sm ring-1 ring-black/5'
                  }`}
                  aria-label="Choose month and year"
                >
                  <span>{DateTimePickerConstants.MONTH_LABELS[visibleMonth.getMonth()]} {visibleMonth.getFullYear()}</span>
                  <FrameworkIcons.Down size={16} className={`transition-transform duration-200 ${isJumpViewOpen ? 'rotate-180' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => onShiftMonth(1)}
                  className={`flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-150 ${
                    theme === 'dark'
                      ? 'bg-slate-700/40 text-slate-300 hover:bg-indigo-500/20 hover:text-indigo-200 active:scale-95 ring-1 ring-white/5'
                      : 'bg-white text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 active:scale-95 shadow-sm ring-1 ring-black/5'
                  }`}
                  aria-label="Next month"
                >
                  <FrameworkIcons.Right size={18} />
                </button>
              </div>
            </div>
            {isJumpViewOpen ? (
              <DateTimePickerJumpView
                theme={theme}
                visibleMonth={visibleMonth}
                onShiftYear={onShiftYear}
                onJumpMonthSelect={onJumpMonthSelect}
              />
            ) : (
              <DayPicker
                mode="single"
                selected={pickerDate}
                onSelect={onSelect}
                month={visibleMonth}
                onMonthChange={onVisibleMonthChange}
                showOutsideDays={false}
                className={`${theme === 'dark' ? 'rdp-dark' : ''}`}
                classNames={DateTimePickerDayClassNames.build(theme)}
              />
            )}

            <DateTimePickerFooter
              theme={theme}
              showTime={showTime}
              timezone={timezone}
              zonedParts={zonedParts}
              onTimeChange={onTimeChange}
              onQuickAction={onQuickAction}
              onClear={onClear}
              onClose={onClose}
            />
          </div>
        </RootFramework>
    );
  }
}

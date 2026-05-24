"use client";

import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { DayPicker } from 'react-day-picker';
import { FrameworkIcons } from '@fromcode119/react';
import { Button } from './button';
import { RootFramework } from '@fromcode119/react';
import { ThemeHooks } from '../use-theme';
import { UiFieldUtils } from '@/lib/ui';
import { TimezoneUtils } from '@/lib/timezone';

const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

interface DateTimePickerProps {
  value?: string;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  showTime?: boolean;
  placeholder?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const DateTimePicker = ({ 
  value, 
  onChange, 
  disabled, 
  showTime = true, 
  placeholder = "Select date...", 
  className = "",
  size = "md"
}: DateTimePickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const { theme } = ThemeHooks.useTheme();
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const timezone = TimezoneUtils.resolveSystemTimezone();
  const utcDate = TimezoneUtils.parseDateValue(value);
  const zonedParts = TimezoneUtils.getZonedDateParts(utcDate, timezone);
  const pickerDate = zonedParts
    ? new Date(zonedParts.year, zonedParts.month - 1, zonedParts.day, 12, 0, 0)
    : undefined;
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => pickerDate || new Date());
  const [isJumpViewOpen, setIsJumpViewOpen] = useState(false);
  const today = new Date();
  const selectedSummary = value && utcDate
    ? TimezoneUtils.formatSystemDate(
        utcDate,
        showTime ? { dateStyle: 'full', timeStyle: 'short' } : { dateStyle: 'full' },
        placeholder,
        timezone,
      )
    : 'No date selected';
  const currentVisibleYear = visibleMonth.getFullYear();

  // Only sync visible month when the picker first opens — not on every render.
  // pickerDate is a new Date object on each render so including it in the
  // dependency array would reset the visible month on every state change.
  useEffect(() => {
    if (!isOpen) return;
    const base = utcDate ? TimezoneUtils.getZonedDateParts(utcDate, timezone) : null;
    const openMonth = base
      ? new Date(base.year, base.month - 1, 1)
      : new Date();
    setVisibleMonth(openMonth);
    setIsJumpViewOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);
  
  const updatePosition = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const popoverWidth = 360;
      const popoverHeight = showTime ? 460 : 380;
      const viewportPadding = 12;
      const maxLeft = Math.max(viewportPadding, window.innerWidth - popoverWidth - viewportPadding);
      const preferredLeft = rect.left;
      const preferredTop = rect.bottom + 8;
      const shouldOpenUpwards = preferredTop + popoverHeight > window.innerHeight - viewportPadding;
      const top = shouldOpenUpwards
        ? Math.max(viewportPadding, rect.top - popoverHeight - 8)
        : Math.max(viewportPadding, preferredTop);

      setCoords({
        top,
        left: Math.min(Math.max(preferredLeft, viewportPadding), maxLeft),
        width: rect.width
      });
    }
  };

  useLayoutEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
    }
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current && !containerRef.current.contains(event.target as Node) &&
        popoverRef.current && !popoverRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const commitDate = (selectedDate: Date, shouldClose: boolean) => {
    const baseTime = zonedParts || TimezoneUtils.getZonedDateParts(new Date(), timezone);
    // CRITICAL: DayPicker creates Date objects at midnight in the browser's local timezone.
    // The Date constructor: new Date(2026, 0, 7) creates Jan 7, 2026 at 00:00:00 local time.
    // When we call .getFullYear(), .getMonth(), .getDate() on this Date, we get the LOCAL
    // calendar values (2026, 0, 7), which is exactly what we want.
    // We then pass these calendar values to zonedPartsToUtcDate with the system timezone
    // to create the correct UTC timestamp representing that calendar day at midnight in
    // the system timezone.
    const finalUtcDate = TimezoneUtils.zonedPartsToUtcDate({
      year: selectedDate.getFullYear(),
      month: selectedDate.getMonth() + 1,
      day: selectedDate.getDate(),
      hour: showTime ? (baseTime?.hour || 0) : 0,
      minute: showTime ? (baseTime?.minute || 0) : 0,
      second: 0
    }, timezone);

    onChange(finalUtcDate.toISOString());
    setVisibleMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
    if (shouldClose) setIsOpen(false);
  };

  const handleSelect = (selectedDate: Date | undefined) => {
    if (!selectedDate) {
      onChange(null);
      return;
    }

    commitDate(selectedDate, !showTime);
  };

  const handleTimeChange = (type: 'hours' | 'minutes', val: string) => {
    const base = zonedParts || TimezoneUtils.getZonedDateParts(new Date(), timezone);
    if (!base) return;

    const parsed = Number.parseInt(val, 10);
    const num = Number.isNaN(parsed) ? 0 : parsed;
    const clamped = type === 'hours'
      ? Math.min(23, Math.max(0, num))
      : Math.min(59, Math.max(0, num));

    const next = {
      ...base,
      hour: type === 'hours' ? clamped : base.hour,
      minute: type === 'minutes' ? clamped : base.minute,
      second: 0
    };
    onChange(TimezoneUtils.zonedPartsToUtcDate(next, timezone).toISOString());
  };

  const shiftVisibleMonth = (monthOffset: number) => {
    setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + monthOffset, 1));
  };

  const shiftVisibleYear = (yearOffset: number) => {
    setVisibleMonth(new Date(visibleMonth.getFullYear() + yearOffset, visibleMonth.getMonth(), 1));
  };

  const handleJumpMonthSelect = (monthIndex: number) => {
    setVisibleMonth(new Date(visibleMonth.getFullYear(), monthIndex, 1));
    setIsJumpViewOpen(false);
  };

  const applyQuickAction = (dayOffset: number) => {
    const quickDate = new Date();
    quickDate.setDate(quickDate.getDate() + dayOffset);
    commitDate(quickDate, !showTime);
  };

  const handleClear = () => {
    onChange(null);
    setVisibleMonth(new Date());
    if (!showTime) {
      setIsOpen(false);
    }
  };

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      <div 
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`${UiFieldUtils.getFieldClasses(size, `cursor-pointer flex items-center justify-between transition-all duration-150 ${isOpen ? 'ring-2 ring-indigo-500/50' : ''}`)} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <div className="flex items-center gap-2.5">
           <FrameworkIcons.Calendar size={17} className={`transition-colors ${isOpen ? 'text-indigo-500' : 'text-slate-400'}`} />
           <span className={`tracking-tight ${!value ? 'text-slate-400 font-normal' : 'font-medium'}`}>
             {value && utcDate
               ? TimezoneUtils.formatSystemDate(
                   utcDate,
                   showTime
                     ? { dateStyle: 'medium', timeStyle: 'short' }
                     : { dateStyle: 'medium' },
                   placeholder,
                   timezone
                 )
               : placeholder}
           </span>
        </div>
        {value && !disabled && (
          <div 
            onClick={(e) => { e.stopPropagation(); onChange(null); }}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-all duration-150 active:scale-90"
          >
            <FrameworkIcons.Close size={15} />
          </div>
        )}
      </div>

      {isOpen && (
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
                  onClick={() => setVisibleMonth(pickerDate || new Date())}
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
                  onClick={() => shiftVisibleMonth(-1)}
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
                  onClick={() => setIsJumpViewOpen((current) => !current)}
                  className={`flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-semibold tracking-tight transition-all duration-150 ${
                    theme === 'dark'
                      ? 'bg-slate-700/40 text-white hover:bg-indigo-500/20 hover:text-indigo-100 active:scale-[0.98] ring-1 ring-white/5'
                      : 'bg-white text-slate-900 hover:bg-indigo-50 hover:text-indigo-700 active:scale-[0.98] shadow-sm ring-1 ring-black/5'
                  }`}
                  aria-label="Choose month and year"
                >
                  <span>{MONTH_LABELS[visibleMonth.getMonth()]} {visibleMonth.getFullYear()}</span>
                  <FrameworkIcons.Down size={16} className={`transition-transform duration-200 ${isJumpViewOpen ? 'rotate-180' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => shiftVisibleMonth(1)}
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
              <div className={`space-y-5 rounded-xl p-5 ${theme === 'dark' ? 'bg-slate-800/40 ring-1 ring-white/5' : 'bg-slate-50/80 ring-1 ring-black/5'}`}>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => shiftVisibleYear(-1)}
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
                    onClick={() => shiftVisibleYear(1)}
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
                  {MONTH_LABELS.map((label, monthIndex) => {
                    const isActive = visibleMonth.getMonth() === monthIndex;
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => handleJumpMonthSelect(monthIndex)}
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
            ) : (
              <DayPicker
                mode="single"
                selected={pickerDate}
                onSelect={handleSelect}
                month={visibleMonth}
                onMonthChange={setVisibleMonth}
                showOutsideDays={false}
                className={`${theme === 'dark' ? 'rdp-dark' : ''}`}
                classNames={{
                  months: "flex flex-col",
                  month: "space-y-4",
                  month_caption: "hidden",
                  caption_label: "text-sm font-bold text-indigo-600",
                  nav: "hidden",
                  button_previous: "hidden",
                  button_next: "hidden",
                  month_grid: "w-full border-separate border-spacing-1",
                  weekdays: "mb-1",
                  weekday: "h-9 w-11 p-0 text-center align-middle text-slate-400 font-bold text-[10px] uppercase tracking-wider",
                  weeks: "",
                  week: "",
                  day: "h-11 w-11 p-0 text-center align-middle",
                  day_button: `flex h-10 w-10 items-center justify-center rounded-xl p-0 font-semibold text-[14px] tracking-tight transition-all duration-150 mx-auto
                    ${theme === 'dark' 
                      ? 'text-slate-100 hover:bg-slate-700/50 hover:scale-105 active:scale-95' 
                      : 'text-slate-700 hover:bg-slate-100 hover:scale-105 active:scale-95'}`,
                  selected: theme === 'dark'
                    ? "!bg-indigo-500 !text-white hover:!bg-indigo-500 shadow-xl shadow-indigo-500/40 ring-2 ring-indigo-400/50 scale-105"
                    : "!bg-indigo-600 !text-white hover:!bg-indigo-600 shadow-xl shadow-indigo-600/40 ring-2 ring-indigo-500/60 scale-105",
                  today: theme === 'dark'
                    ? "ring-2 ring-indigo-400/30 text-indigo-300 font-bold"
                    : "ring-2 ring-indigo-500/30 text-indigo-600 font-bold",
                  outside: "pointer-events-none opacity-0",
                  disabled: "opacity-20 cursor-not-allowed",
                  hidden: "pointer-events-none opacity-0",
                }}
              />
            )}

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
                      onChange={(e) => handleTimeChange('hours', e.target.value)}
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
                      onChange={(e) => handleTimeChange('minutes', e.target.value)}
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
                  onClick={() => applyQuickAction(0)}
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
                  onClick={() => applyQuickAction(1)}
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
                  onClick={handleClear}
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
                  onClick={() => setIsOpen(false)}
                >
                  Apply Selection
                </Button>
              ) : null}
            </div>
          </div>
        </RootFramework>
      )}
    </div>
  );
};

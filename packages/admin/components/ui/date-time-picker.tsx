"use client";

import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { DayPicker } from 'react-day-picker';
import { FrameworkIcons } from '@/lib/icons';
import { Button } from './button';
import { RootFramework } from '@fromcode119/react';
import { ThemeHooks } from '../use-theme';
import { UiFieldUtils } from '@/lib/ui';
import { TimezoneUtils } from '@/lib/timezone';

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
    ? new Date(zonedParts.year, zonedParts.month - 1, zonedParts.day)
    : undefined;
  
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

  const handleSelect = (selectedDate: Date | undefined) => {
    if (!selectedDate) {
        onChange(null);
        return;
    }

    const baseTime = zonedParts || TimezoneUtils.getZonedDateParts(new Date(), timezone);
    const finalUtcDate = TimezoneUtils.zonedPartsToUtcDate({
      year: selectedDate.getFullYear(),
      month: selectedDate.getMonth() + 1,
      day: selectedDate.getDate(),
      hour: showTime ? (baseTime?.hour || 0) : 0,
      minute: showTime ? (baseTime?.minute || 0) : 0,
      second: 0
    }, timezone);

    onChange(finalUtcDate.toISOString());
    if (!showTime) setIsOpen(false);
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

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      <div 
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`${UiFieldUtils.getFieldClasses(size, `cursor-pointer flex items-center justify-between ${isOpen ? 'border-indigo-500 ring-4 ring-indigo-500/10' : ''}`)} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <div className="flex items-center gap-2">
           <FrameworkIcons.Calendar size={16} className="text-slate-400" />
           <span className={!value ? 'text-slate-400 font-normal' : ''}>
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
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-slate-400 transition-colors"
          >
            <FrameworkIcons.Close size={14} />
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
              width: 'min(360px, calc(100vw - 24px))',
              maxWidth: 'calc(100vw - 24px)',
              zIndex: 9999
            }}
            className={`p-5 rounded-lg border animate-in zoom-in-95 slide-in-from-top-2 duration-300 shadow-2xl
              ${theme === 'dark' 
                ? 'bg-slate-950/95 border-white/10 backdrop-blur-3xl' 
                : 'bg-white/95 border-slate-200 shadow-slate-200 backdrop-blur-3xl'}`}
          >
            <DayPicker
              mode="single"
              selected={pickerDate}
              onSelect={handleSelect}
              showOutsideDays={false}
              className={`${theme === 'dark' ? 'rdp-dark' : ''}`}
              classNames={{
                months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                month: "space-y-4",
                month_caption: "flex justify-between items-center px-2 py-1",
                caption_label: "text-sm font-bold text-indigo-600",
                nav: "flex items-center gap-1",
                button_previous: `h-8 w-8 bg-transparent p-0 opacity-50 hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800`,
                button_next: `h-8 w-8 bg-transparent p-0 opacity-50 hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800`,
                month_grid: "w-full border-separate border-spacing-y-1",
                weekdays: "",
                weekday: "h-8 w-10 p-0 text-center align-middle text-slate-400 font-semibold text-[10px]",
                weeks: "",
                week: "",
                day: "h-10 w-10 p-0 text-center align-middle",
                day_button: `flex h-9 w-9 items-center justify-center rounded-lg p-0 font-semibold text-[12px] transition-all mx-auto text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800`,
                selected: "bg-indigo-600 !text-white hover:bg-indigo-600 shadow-lg shadow-indigo-600/30",
                today: "border-2 border-indigo-500/20 text-indigo-500",
                outside: "pointer-events-none opacity-0",
                disabled: "opacity-20",
                hidden: "pointer-events-none opacity-0",
              }}
              components={{
                Chevron: ({ orientation }: { orientation?: string }) => 
                  orientation === 'right' ? <FrameworkIcons.Right size={16} /> : <FrameworkIcons.Left size={16} />,
              }}
            />

            {showTime && (
              <div className={`mt-6 pt-6 border-t flex flex-col gap-4 ${theme === 'dark' ? 'border-white/5' : 'border-slate-100'}`}>
                <div className="flex items-center gap-3">
                   <div className="h-10 w-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500 shadow-sm">
                      <FrameworkIcons.Clock size={16} />
                   </div>
                   <div className="flex flex-col">
                      <span className="text-[11px] font-semibold text-slate-500">Time Precision</span>
                      <span className="text-[10px] font-medium text-slate-400 italic">Timezone: {timezone}</span>
                   </div>
                </div>

                <div className="flex items-center gap-3 justify-center">
                  <div className="flex flex-col gap-1 w-16">
                    <span className="text-[10px] font-semibold text-slate-400 text-center">Hour</span>
                    <input 
                      type="number"
                      min="0"
                      max="23"
                      value={zonedParts?.hour || 0}
                      onChange={(e) => handleTimeChange('hours', e.target.value)}
                      className={`w-full h-10 rounded-lg border text-center font-semibold transition-all outline-none ${
                        theme === 'dark' 
                          ? 'bg-slate-900 border-slate-800 text-white focus:bg-slate-800 focus:border-indigo-500' 
                          : 'bg-slate-50 border-slate-100 text-slate-900 focus:bg-white focus:border-indigo-500 shadow-inner'
                      }`}
                    />
                  </div>
                  <span className="text-xl font-semibold text-slate-300 pt-5">:</span>
                  <div className="flex flex-col gap-1 w-16">
                    <span className="text-[10px] font-semibold text-slate-400 text-center">Min</span>
                    <input 
                      type="number"
                      min="0"
                      max="59"
                      value={zonedParts?.minute || 0}
                      onChange={(e) => handleTimeChange('minutes', e.target.value)}
                      className={`w-full h-10 rounded-lg border text-center font-semibold transition-all outline-none ${
                        theme === 'dark' 
                          ? 'bg-slate-900 border-slate-800 text-white focus:bg-slate-800 focus:border-indigo-500' 
                          : 'bg-slate-50 border-slate-100 text-slate-900 focus:bg-white focus:border-indigo-500 shadow-inner'
                      }`}
                    />
                  </div>
                </div>
              </div>
            )}
            
            <div className={`mt-6 pt-6 border-t flex justify-end ${theme === 'dark' ? 'border-white/5' : 'border-slate-100'}`}>
               <Button 
                variant="primary" 
                size="md" 
                className="w-full rounded-lg font-semibold text-[11px] shadow-xl shadow-indigo-600/20"
                onClick={() => setIsOpen(false)}
               >
                 Confirm Selection
               </Button>
            </div>
          </div>
        </RootFramework>
      )}
    </div>
  );
};

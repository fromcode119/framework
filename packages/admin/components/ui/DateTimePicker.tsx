"use client";

import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { DayPicker } from 'react-day-picker';
import { format, parseISO, isValid } from 'date-fns';
import { FrameworkIcons } from '@/lib/icons';
import { Button } from './Button';
import { RootFramework } from '@fromcode/react';
import { useTheme } from '../ThemeContext';

interface DateTimePickerProps {
  value?: string;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  showTime?: boolean;
  placeholder?: string;
  className?: string;
}

export const DateTimePicker = ({ 
  value, 
  onChange, 
  disabled, 
  showTime = true, 
  placeholder = "Select date...", 
  className = "" 
}: DateTimePickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  const date = value && isValid(parseISO(value)) ? parseISO(value) : undefined;
  
  const updatePosition = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + 8,
        left: rect.left,
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
    
    // Preserve time if it exists in current value
    const finalDate = new Date(selectedDate);
    if (date && showTime) {
        finalDate.setHours(date.getHours());
        finalDate.setMinutes(date.getMinutes());
    }
    
    onChange(finalDate.toISOString());
    if (!showTime) setIsOpen(false);
  };

  const handleTimeChange = (type: 'hours' | 'minutes', val: string) => {
    const newDate = date ? new Date(date) : new Date();
    const num = parseInt(val) || 0;
    
    if (type === 'hours') newDate.setHours(Math.min(23, Math.max(0, num)));
    else newDate.setMinutes(Math.min(59, Math.max(0, num)));
    
    onChange(newDate.toISOString());
  };

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      <div 
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full rounded-2xl py-3 px-4 text-sm font-bold outline-none border transition-all cursor-pointer flex items-center justify-between
          ${theme === 'dark' 
            ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' 
            : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500 shadow-sm'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-slate-400 dark:hover:border-slate-600'} ${isOpen ? 'border-indigo-500 ring-2 ring-indigo-500/10' : ''}`}
      >
        <div className="flex items-center gap-2">
           <FrameworkIcons.Calendar size={16} className="text-slate-400" />
           <span className={!value ? 'text-slate-400 font-normal' : ''}>
             {value && date && isValid(date) 
               ? format(date, showTime ? "PPP p" : "PPP") 
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
              zIndex: 9999
            }}
            className={`p-6 rounded-[2.5rem] border animate-in zoom-in-95 slide-in-from-top-2 duration-300 shadow-2xl
              ${theme === 'dark' 
                ? 'bg-slate-950/95 border-white/10 backdrop-blur-3xl' 
                : 'bg-white/95 border-slate-200 shadow-slate-200 backdrop-blur-3xl'}`}
          >
            <DayPicker
              mode="single"
              selected={date}
              onSelect={handleSelect}
              className={`${theme === 'dark' ? 'rdp-dark' : ''}`}
              classNames={{
                months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                month: "space-y-4",
                caption: "flex justify-between items-center px-2 py-1",
                caption_label: "text-sm font-black uppercase tracking-widest text-indigo-500",
                nav: "flex items-center gap-1",
                nav_button: `h-8 w-8 bg-transparent p-0 opacity-50 hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800`,
                table: "border-collapse space-y-1",
                head_row: "flex",
                head_cell: "text-slate-400 rounded-md w-9 font-black text-[10px] uppercase tracking-widest py-2",
                row: "flex w-full mt-2",
                cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
                day: `h-9 w-9 p-0 font-black uppercase text-[10px] tracking-tighter aria-selected:opacity-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all`,
                day_selected: "bg-indigo-600 !text-white hover:bg-indigo-600 shadow-lg shadow-indigo-600/30",
                day_today: "border-2 border-indigo-500/20 text-indigo-500",
                day_outside: "opacity-20",
                day_disabled: "opacity-20",
                day_hidden: "invisible",
              }}
              components={{
                IconLeft: () => <FrameworkIcons.Left size={16} />,
                IconRight: () => <FrameworkIcons.Right size={16} />,
              }}
            />

            {showTime && (
              <div className={`mt-6 pt-6 border-t flex flex-col gap-4 ${theme === 'dark' ? 'border-white/5' : 'border-slate-100'}`}>
                <div className="flex items-center gap-3">
                   <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 shadow-sm">
                      <FrameworkIcons.Clock size={16} />
                   </div>
                   <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Time Precision</span>
                      <span className="text-[9px] font-bold text-slate-400 italic">UTC Timestamp Synchronization</span>
                   </div>
                </div>

                <div className="flex items-center gap-3 justify-center">
                  <div className="flex flex-col gap-1.5 w-16">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Hour</span>
                    <input 
                      type="number"
                      min="0"
                      max="23"
                      value={date?.getHours() || 0}
                      onChange={(e) => handleTimeChange('hours', e.target.value)}
                      className={`w-full h-12 rounded-xl border text-center font-black transition-all outline-none ${
                        theme === 'dark' 
                          ? 'bg-slate-900 border-slate-800 text-white focus:bg-slate-800 focus:border-indigo-500' 
                          : 'bg-slate-50 border-slate-100 text-slate-900 focus:bg-white focus:border-indigo-500 shadow-inner'
                      }`}
                    />
                  </div>
                  <span className="text-xl font-black text-slate-300 pt-5">:</span>
                  <div className="flex flex-col gap-1.5 w-16">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">Min</span>
                    <input 
                      type="number"
                      min="0"
                      max="59"
                      value={date?.getMinutes() || 0}
                      onChange={(e) => handleTimeChange('minutes', e.target.value)}
                      className={`w-full h-12 rounded-xl border text-center font-black transition-all outline-none ${
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
                size="sm" 
                className="w-full rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-indigo-600/20"
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

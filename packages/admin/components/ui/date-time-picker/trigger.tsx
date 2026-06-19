"use client";

import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import { UiFieldUtils } from '@/lib/ui';
import { TimezoneUtils } from '@/lib/timezone';

interface DateTimePickerTriggerProps {
  size: 'sm' | 'md' | 'lg';
  isOpen: boolean;
  disabled?: boolean;
  value?: string;
  utcDate: Date | null;
  showTime: boolean;
  placeholder: string;
  timezone: string;
  onToggle: () => void;
  onClear: () => void;
}

export class DateTimePickerTrigger extends React.Component<DateTimePickerTriggerProps> {
  render(): React.ReactNode {
    const { size, isOpen, disabled, value, utcDate, showTime, placeholder, timezone, onToggle, onClear } = this.props;

    return (
      <div
        onClick={() => !disabled && onToggle()}
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
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-all duration-150 active:scale-90"
          >
            <FrameworkIcons.Close size={15} />
          </div>
        )}
      </div>
    );
  }
}

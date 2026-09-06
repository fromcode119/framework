import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { DateTimePickerGranularity } from '@/components/ui/date-time-picker/enums/date-time-picker-granularity.enum';
import type { MouseEvent, ReactNode } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/reactor';
import { FrameworkIcons } from '@fromcode119/react';
import { UiFieldUtils } from '@/lib/ui';
import { TimezoneUtils } from '@/lib/timezone';

export class DateTimePickerTrigger extends PureReactor {
  @prop declare granularity: DateTimePickerGranularity;
  @prop declare size: FieldSize;
  @prop declare isOpen: boolean;
  @prop declare disabled?: boolean;
  @prop declare value?: string;
  @prop declare utcDate: Date | null;
  @prop declare showTime: boolean;
  @prop declare placeholder: string;
  @prop declare timezone: string;
  @prop declare onToggle: () => void;
  @prop declare onClear: () => void;

  @bound handleToggle(): void {
    if (!this.disabled) this.onToggle();
  }

  @bound handleClear(e: MouseEvent): void {
    e.stopPropagation();
    this.onClear();
  }

  render(): ReactNode {
    const { size, isOpen, disabled, value, utcDate, showTime, placeholder, timezone } = this;

    return (
      <div
        onClick={this.handleToggle}
        className={`${UiFieldUtils.getFieldClasses(size, `cursor-pointer flex items-center justify-between transition-all duration-150 ${isOpen ? 'ring-2 ring-indigo-500/50' : ''}`)} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <div className="flex items-center gap-2.5">
           <FrameworkIcons.Calendar size={17} className={`transition-colors ${isOpen ? 'text-indigo-500' : 'text-slate-400'}`} />
           <span className={`tracking-tight ${!value ? 'text-slate-400 font-normal' : 'font-medium'}`}>
             {value && !this.granularity.usesCalendar
               ? this.granularity.formatValue(value)
               : value && utcDate
               ? TimezoneUtils.formatSystemDate(
                   // The RAW value, not the pre-parsed Date: a literal `YYYY-MM-DD` must be
                   // recognized and rendered as that calendar day, not shifted through a timezone.
                   value,
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
            onClick={this.handleClear}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-all duration-150 active:scale-90"
          >
            <FrameworkIcons.Close size={15} />
          </div>
        )}
      </div>
    );
  }
}

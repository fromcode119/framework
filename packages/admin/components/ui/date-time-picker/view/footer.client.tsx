import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { TimePart } from '@/components/ui/date-time-picker/enums/time-part.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { Button } from '@/components/ui/view/button.client';
import { NumberStepper } from '@/components/ui/number-stepper';

export class DateTimePickerFooter extends PureReactor {
  @prop declare theme: ThemeMode;
  @prop declare showTime: boolean;
  @prop declare timezone: string;
  @prop declare zonedParts: any;
  @prop declare onTimeChange: (type: TimePart, val: string) => void;
  @prop declare onQuickAction: (dayOffset: number) => void;
  @prop declare onClear: () => void;
  @prop declare onClose: () => void;

  /** Stable identities, passed to NumberStepper by NAME — never an inline arrow in render. */
  @bound private changeHours(value: number | string): void {
    this.onTimeChange(TimePart.HOURS, String(value));
  }

  @bound private changeMinutes(value: number | string): void {
    this.onTimeChange(TimePart.MINUTES, String(value));
  }

  render(): ReactNode {
    const { theme, showTime, timezone, zonedParts, onQuickAction, onClear, onClose } = this;

    return (
      <>
        {showTime && (
          /* Label and fields share ONE row. Stacked, they cost ~110px of a popover that already
             overflowed the viewport; side by side they cost ~44px and read the same. */
          <div className={`mt-3 pt-3 flex items-center justify-between gap-3 ${theme === ThemeMode.DARK ? 'border-t border-white/5' : 'border-t border-slate-200/80'}`}>
            <div className="flex min-w-0 items-center gap-2.5">
               <div className={`h-8 w-8 shrink-0 rounded-lg flex items-center justify-center shadow-sm transition-all duration-150 ${
                 theme === ThemeMode.DARK
                   ? 'bg-indigo-500/10 text-indigo-300 ring-1 ring-indigo-400/20'
                   : 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-500/20'
               }`}>
                  <FrameworkIcons.Clock size={15} />
               </div>
               <div className="flex min-w-0 flex-col">
                  <span className={`text-[11px] font-semibold tracking-tight ${theme === ThemeMode.DARK ? 'text-slate-200' : 'text-slate-900'}`}>Time</span>
                  <span className="truncate text-[10px] font-medium text-slate-400 tracking-tight">{timezone}</span>
               </div>
            </div>

            <div className="flex shrink-0 items-end gap-1.5">
              <div className="flex w-[68px] flex-col gap-0.5">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 text-center">Hour</span>
                <NumberStepper
                  size={FieldSize.SM}
                  min={0}
                  max={23}
                  value={zonedParts?.hour ?? 0}
                  onChange={this.changeHours}
                />
              </div>
              <span className={`pb-2 text-[15px] font-bold ${theme === ThemeMode.DARK ? 'text-slate-400' : 'text-slate-300'}`}>:</span>
              <div className="flex w-[68px] flex-col gap-0.5">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 text-center">Min</span>
                <NumberStepper
                  size={FieldSize.SM}
                  min={0}
                  max={59}
                  value={zonedParts?.minute ?? 0}
                  onChange={this.changeMinutes}
                />
              </div>
            </div>
          </div>
        )}

        <div className={`mt-3 pt-3 flex flex-col gap-2.5 ${theme === ThemeMode.DARK ? 'border-t border-white/5' : 'border-t border-slate-200/80'}`}>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onQuickAction(0)}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold tracking-tight transition-all duration-150 ${
                theme === ThemeMode.DARK
                  ? 'bg-slate-700/40 text-slate-200 hover:bg-indigo-500/10 hover:text-indigo-200 active:scale-95 ring-1 ring-white/5'
                  : 'bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 active:scale-95 ring-1 ring-black/5'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => onQuickAction(1)}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold tracking-tight transition-all duration-150 ${
                theme === ThemeMode.DARK
                  ? 'bg-slate-700/40 text-slate-200 hover:bg-indigo-500/10 hover:text-indigo-200 active:scale-95 ring-1 ring-white/5'
                  : 'bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 active:scale-95 ring-1 ring-black/5'
              }`}
            >
              Tomorrow
            </button>
            <button
              type="button"
              onClick={onClear}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold tracking-tight transition-all duration-150 ${
                theme === ThemeMode.DARK
                  ? 'bg-slate-700/40 text-slate-200 hover:bg-rose-500/10 hover:text-rose-300 active:scale-95 ring-1 ring-white/5'
                  : 'bg-slate-100 text-slate-700 hover:bg-rose-50 hover:text-rose-600 active:scale-95 ring-1 ring-black/5'
              }`}
            >
              Clear
            </button>
          </div>
          {showTime ? (
            <Button
              variant={ButtonVariant.PRIMARY}
              size={FieldSize.MD}
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

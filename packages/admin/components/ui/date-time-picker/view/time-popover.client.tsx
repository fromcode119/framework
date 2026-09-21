import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { TimePart } from '@/components/ui/date-time-picker/enums/time-part.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { FrameworkIcons, RootFramework } from '@fromcode119/react';
import { Button } from '@/components/ui/view/button.client';
import { NumberStepper } from '@/components/ui/number-stepper';
import { TimeOfDayUtils } from '@/components/ui/date-time-picker/time-of-day-utils';
import type { IDateTimePickerCoords } from '@/components/ui/date-time-picker/interfaces/date-time-picker-coords.interface';

/**
 * The popover for TIME granularity: an hour and a minute stepper and nothing else — no calendar,
 * no month strip, no timezone line. A time of day names a position in the operator's own working
 * day (an opening hour, a shift start), so it is never rendered through a timezone the way an
 * instant is. Commits `HH:mm` on every edit; the Done button only closes.
 */
export class DateTimePickerTimePopover extends PureReactor {
  @prop declare theme: ThemeMode;
  @prop declare value?: string;
  @prop declare minuteStep: number;
  @prop declare coords: IDateTimePickerCoords;
  @prop declare popoverRef: any;
  @prop declare onChange: (value: string) => void;
  @prop declare onClear: () => void;
  @prop declare onClose: () => void;

  /** Stable identities, passed to NumberStepper by NAME — never an inline arrow in render. */
  @bound private changeHours(value: number | string): void {
    this.onChange(TimeOfDayUtils.withPart(this.value, TimePart.HOURS, String(value)));
  }

  @bound private changeMinutes(value: number | string): void {
    this.onChange(TimeOfDayUtils.withPart(this.value, TimePart.MINUTES, String(value)));
  }

  render(): ReactNode {
    const { theme, coords, popoverRef, minuteStep, onClear, onClose } = this;
    const dark = theme === ThemeMode.DARK;
    const parts = TimeOfDayUtils.parse(this.value);

    return (
      <RootFramework>
        <div
          ref={popoverRef}
          style={{ position: 'fixed', top: coords.top, left: coords.left, width: 'min(260px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 24px)', overflowY: 'auto', zIndex: 9999 }}
          className={`animate-in zoom-in-95 slide-in-from-top-2 rounded-xl p-4 duration-200 ${
            dark
              ? 'bg-slate-900 ring-1 ring-white/10 shadow-2xl shadow-black/50'
              : 'bg-white ring-1 ring-black/10 shadow-2xl shadow-slate-900/20'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className={`h-8 w-8 shrink-0 rounded-lg flex items-center justify-center shadow-sm transition-all duration-150 ${
                dark
                  ? 'bg-indigo-500/10 text-indigo-300 ring-1 ring-indigo-400/20'
                  : 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-500/20'
              }`}>
                <FrameworkIcons.Clock size={15} />
              </div>
              <span className={`text-[11px] font-semibold tracking-tight ${dark ? 'text-slate-200' : 'text-slate-900'}`}>Time</span>
            </div>

            <div className="flex shrink-0 items-end gap-1.5">
              <div className="flex w-[68px] flex-col gap-0.5">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 text-center">Hour</span>
                <NumberStepper size={FieldSize.SM} min={0} max={23} value={parts.hour} onChange={this.changeHours} />
              </div>
              <span className={`pb-2 text-[15px] font-bold ${dark ? 'text-slate-400' : 'text-slate-300'}`}>:</span>
              <div className="flex w-[68px] flex-col gap-0.5">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 text-center">Min</span>
                <NumberStepper size={FieldSize.SM} min={0} max={59} step={minuteStep} value={parts.minute} onChange={this.changeMinutes} />
              </div>
            </div>
          </div>

          <div className={`mt-3 flex flex-col gap-2.5 border-t pt-3 ${dark ? 'border-white/5' : 'border-slate-200/80'}`}>
            <button
              type="button"
              onClick={onClear}
              className={`self-start rounded-lg px-3 py-1.5 text-[11px] font-semibold tracking-tight transition-all duration-150 ${
                dark
                  ? 'bg-slate-700/40 text-slate-200 hover:bg-rose-500/10 hover:text-rose-300 active:scale-95 ring-1 ring-white/5'
                  : 'bg-slate-100 text-slate-700 hover:bg-rose-50 hover:text-rose-600 active:scale-95 ring-1 ring-black/5'
              }`}
            >
              Clear
            </button>
            <Button
              variant={ButtonVariant.PRIMARY}
              size={FieldSize.MD}
              className="w-full rounded-xl font-semibold text-[13px] tracking-tight shadow-lg active:scale-[0.98] transition-all duration-150"
              onClick={onClose}
            >
              Done
            </Button>
          </div>
        </div>
      </RootFramework>
    );
  }
}

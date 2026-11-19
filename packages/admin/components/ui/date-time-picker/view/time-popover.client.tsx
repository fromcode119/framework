import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { TimePart } from '@/components/ui/date-time-picker/enums/time-part.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { RootFramework } from '@fromcode119/react';
import { Button } from '@/components/ui/view/button.client';
import { NumberStepper } from '@/components/ui/number-stepper';
import { TimeOfDayUtils } from '@/components/ui/date-time-picker/time-of-day-utils';
import type { IDateTimePickerCoords } from '@/components/ui/date-time-picker/interfaces/date-time-picker-coords.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

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
          style={{ position: 'fixed', top: coords.top, left: coords.left, width: 'min(300px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 24px)', overflowY: 'auto', overflowX: 'hidden', zIndex: 9999 }}
          className={`fc-menu-sheet border p-2 shadow-lg ${
            dark
              ? 'bg-slate-900 border-slate-800 shadow-black/40'
              : 'bg-white border-slate-200 shadow-slate-900/[0.08]'
          }`}
        >
          <div className="flex items-center justify-center">
            <div className="flex shrink-0 items-end gap-1.5">
              <div className="fc-cal__time-cell">
                <span className="fc-cal__sum-label text-center">{AdminI18n.t('ui.date.hour')}</span>
                <NumberStepper size={FieldSize.SM} min={0} max={23} value={parts.hour} onChange={this.changeHours} />
              </div>
              <span className="pb-1.5 text-[13px] font-medium text-[color:var(--fc-text-muted)]">:</span>
              <div className="fc-cal__time-cell">
                <span className="fc-cal__sum-label text-center">{AdminI18n.t('ui.date.minute')}</span>
                <NumberStepper size={FieldSize.SM} min={0} max={59} step={minuteStep} value={parts.minute} onChange={this.changeMinutes} />
              </div>
            </div>
          </div>

          <div className="fc-cal__foot">
            <button type="button" onClick={onClear} className="fc-btn">{AdminI18n.t('ui.date.clear')}</button>
            <Button variant={ButtonVariant.PRIMARY} size={FieldSize.SM} className="fc-cal__apply" onClick={onClose}>
              {AdminI18n.t('ui.date.done')}
            </Button>
          </div>
        </div>
      </RootFramework>
    );
  }
}

import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { TimePart } from '@/components/ui/date-time-picker/enums/time-part.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { Button } from '@/components/ui/view/button.client';
import { NumberStepper } from '@/components/ui/number-stepper';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

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
          <div className="mt-2 pt-2 flex items-center justify-between gap-3 border-t border-[color:var(--fc-border)]">
            <div className="flex min-w-0 items-center gap-2">
               <div className="flex min-w-0 flex-col">
                  <span className="fc-cal__sum-value">{AdminI18n.t('ui.date.time')}</span>
                  <span className="fc-cal__sum-label truncate">{timezone}</span>
               </div>
            </div>

            <div className="flex shrink-0 items-end gap-1.5">
              <div className="fc-cal__time-cell">
                <span className="fc-cal__sum-label text-center">{AdminI18n.t('ui.date.hour')}</span>
                <NumberStepper
                  size={FieldSize.SM}
                  min={0}
                  max={23}
                  value={zonedParts?.hour ?? 0}
                  onChange={this.changeHours}
                />
              </div>
              <span className="pb-1.5 text-[13px] font-medium text-[color:var(--fc-text-muted)]">:</span>
              <div className="fc-cal__time-cell">
                <span className="fc-cal__sum-label text-center">{AdminI18n.t('ui.date.minute')}</span>
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

        <div className="fc-cal__foot">
          <button type="button" onClick={() => onQuickAction(0)} className="fc-btn">{AdminI18n.t('ui.date.today')}</button>
          <button type="button" onClick={() => onQuickAction(1)} className="fc-btn">{AdminI18n.t('ui.date.tomorrow')}</button>
          <button type="button" onClick={onClear} className="fc-btn">{AdminI18n.t('ui.date.clear')}</button>
          {showTime ? (
            <Button variant={ButtonVariant.PRIMARY} size={FieldSize.SM} className="fc-cal__apply" onClick={onClose}>
              {AdminI18n.t('ui.date.done')}
            </Button>
          ) : null}
        </div>
      </>
    );
  }
}

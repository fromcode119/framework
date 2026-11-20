import type { Ref } from '@fromcode119/react-class-components';
import { TimePart } from '@/components/ui/date-time-picker/enums/time-part.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { DayPicker } from 'react-day-picker';
import { FrameworkIcons } from '@fromcode119/react';
import { RootFramework } from '@fromcode119/react';
import { TimezoneUtils } from '@/lib/timezone';
import { DateTimePickerConstants } from '@/components/ui/date-time-picker/constants/date-time-picker.constants';
import { DateTimePickerDayClassNames } from '@/components/ui/date-time-picker/day-classnames';
import { DateTimePickerJumpView } from '@/components/ui/date-time-picker/view/jump-view.client';
import { DateTimePickerFooter } from '@/components/ui/date-time-picker/view/footer.client';
import type { IDateTimePickerCoords } from '@/components/ui/date-time-picker/interfaces/date-time-picker-coords.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class DateTimePickerPopover extends PureReactor {
  @prop declare theme: ThemeMode;
  @prop declare showTime: boolean;
  @prop declare timezone: string;
  @prop declare placeholder: string;
  @prop declare value?: string;
  @prop declare coords: IDateTimePickerCoords;
  @prop declare visibleMonth: Date;
  @prop declare isJumpViewOpen: boolean;
  @prop declare utcDate: Date | null;
  @prop declare zonedParts: any;
  @prop declare pickerDate?: Date;
  @prop declare popoverRef: Ref<HTMLDivElement>;
  @prop declare onJumpToSelected: () => void;
  @prop declare onShiftMonth: (offset: number) => void;
  @prop declare onToggleJumpView: () => void;
  @prop declare onShiftYear: (offset: number) => void;
  @prop declare onJumpMonthSelect: (monthIndex: number) => void;
  @prop declare onSelect: (date: Date | undefined) => void;
  @prop declare onVisibleMonthChange: (next: Date) => void;
  @prop declare onTimeChange: (type: TimePart, val: string) => void;
  @prop declare onQuickAction: (dayOffset: number) => void;
  @prop declare onClear: () => void;
  @prop declare onClose: () => void;

  render(): ReactNode {
    const {
      theme, showTime, timezone, placeholder, value, coords, visibleMonth, isJumpViewOpen,
      utcDate, zonedParts, pickerDate, popoverRef,
      onJumpToSelected, onShiftMonth, onToggleJumpView, onShiftYear, onJumpMonthSelect,
      onSelect, onVisibleMonthChange, onTimeChange, onQuickAction, onClear, onClose,
    } = this;

    const selectedSummary = value && utcDate
      ? TimezoneUtils.formatSystemDate(
          // The RAW value, not the pre-parsed Date: a literal `YYYY-MM-DD` must be
          // recognized and rendered as that calendar day, not shifted through a timezone.
          value,
          showTime ? { dateStyle: 'full', timeStyle: 'short' } : { dateStyle: 'full' },
          placeholder,
          timezone,
        )
      : AdminI18n.t('ui.date.none');

    return (
        <RootFramework>
          <div
            ref={popoverRef}
            style={{
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              width: 'min(340px, calc(100vw - 32px))',
              maxWidth: 'calc(100vw - 32px)',
              // The popover is 869px tall at full chrome while `computeCoords` assumed 460, so on any
              // laptop viewport the quick-actions row rendered BELOW the fold with no way to reach it.
              // Clamping to the viewport and scrolling internally makes that unreachable-state impossible
              // regardless of what the content grows into later — the height estimate can be wrong again
              // without the control becoming unusable.
              maxHeight: 'calc(100vh - 24px)',
              overflowY: 'auto', overflowX: 'hidden',
              zIndex: 9999
            }}
            // The sheet every menu in this console opens in, not a blurred pane of its own.
            className={`fc-menu-sheet border p-2 shadow-lg ${
              theme === ThemeMode.DARK
                ? 'bg-slate-900 border-slate-800 shadow-black/40'
                : 'bg-white border-slate-200 shadow-slate-900/[0.08]'}`}
          >
            <div className="fc-cal__sum">
              <div className="min-w-0">
                <p className="fc-cal__sum-label">{AdminI18n.t('ui.date.selected')}</p>
                <p className="fc-cal__sum-value truncate">{selectedSummary}</p>
              </div>
              <button type="button" onClick={onJumpToSelected} className="fc-btn shrink-0">
                {AdminI18n.t(pickerDate ? 'ui.date.jump' : 'ui.date.today')}
              </button>
            </div>
            <div className="fc-cal__bar">
              <button
                type="button"
                onClick={() => onShiftMonth(-1)}
                className="fc-btn fc-btn--icon fc-btn--raised"
                aria-label={AdminI18n.t('ui.date.previousMonth')}
              >
                <FrameworkIcons.Left size={15} />
              </button>
              <button
                type="button"
                onClick={onToggleJumpView}
                className="fc-btn w-full justify-center gap-2"
                aria-label={AdminI18n.t('ui.date.chooseMonth')}
              >
                <span>{DateTimePickerConstants.monthLabels()[visibleMonth.getMonth()]} {visibleMonth.getFullYear()}</span>
                <FrameworkIcons.ChevronDown size={15} className={`transition-transform duration-150 ${isJumpViewOpen ? 'rotate-180' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => onShiftMonth(1)}
                className="fc-btn fc-btn--icon fc-btn--raised"
                aria-label={AdminI18n.t('ui.date.nextMonth')}
              >
                <FrameworkIcons.Right size={15} />
              </button>
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
                className={`${theme === ThemeMode.DARK ? 'rdp-dark' : ''}`}
                classNames={DateTimePickerDayClassNames.build(theme)}
                formatters={{ formatWeekdayName: (weekday: Date) => DateTimePickerConstants.weekdayLabel(weekday) }}
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

import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop, state, bound } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { DateTimePickerConstants } from '@/components/ui/date-time-picker/constants/date-time-picker.constants';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class DateTimePickerJumpView extends PureReactor {
  @prop declare theme: ThemeMode;
  @prop declare visibleMonth: Date;
  @prop declare onShiftYear: (offset: number) => void;
  @prop declare onJumpMonthSelect: (monthIndex: number) => void;

  /** Whether the 12-year grid replaces the month grid — so a distant year is one pick, not N clicks. */
  @state isYearGridOpen = false;
  /** First year of the visible 12-year page. */
  @state pageStart = 0;

  @bound private toggleYearGrid(): void {
    const year = this.visibleMonth.getFullYear();
    if (!this.isYearGridOpen) this.pageStart = year - (year % 12);
    this.isYearGridOpen = !this.isYearGridOpen;
  }

  @bound private pickYear(year: number): void {
    this.onShiftYear(year - this.visibleMonth.getFullYear());
    this.isYearGridOpen = false;
  }

  @bound private shiftNav(offset: number): void {
    if (this.isYearGridOpen) this.pageStart += offset * 12;
    else this.onShiftYear(offset);
  }

  render(): ReactNode {
    const { visibleMonth, onJumpMonthSelect, isYearGridOpen, pageStart } = this;
    const currentVisibleYear = visibleMonth.getFullYear();
    const years = Array.from({ length: 12 }, (_, index) => pageStart + index);
    // One chip, the console's button; the picked one takes the primary fill. It used to be an indigo
    // block under a ring and a shadow, in a 12px corner, that shrank when pressed.
    const cellClasses = (isActive: boolean): string => `fc-cal__chip${isActive ? ' fc-cal__chip--on' : ''}`;

    return (
      <div className="space-y-3 p-1">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => this.shiftNav(-1)}
            className="fc-btn fc-btn--icon fc-btn--raised"
            aria-label={AdminI18n.t(isYearGridOpen ? 'ui.date.previousYears' : 'ui.date.previousYear')}
          >
            <FrameworkIcons.Left size={15} />
          </button>
          <div className="text-center">
            <p className="fc-cal__sum-label">{AdminI18n.t(isYearGridOpen ? 'ui.date.chooseYear' : 'ui.date.jumpToMonth')}</p>
            <button
              type="button"
              onClick={this.toggleYearGrid}
              aria-label={AdminI18n.t('ui.date.chooseYear')}
              aria-expanded={isYearGridOpen}
              className="fc-btn fc-btn--ghost mt-0.5 gap-1.5"
            >
              <span>{isYearGridOpen ? `${pageStart} – ${pageStart + 11}` : currentVisibleYear}</span>
              <FrameworkIcons.ChevronDown size={15} className={`transition-transform duration-150 ${isYearGridOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => this.shiftNav(1)}
            className="fc-btn fc-btn--icon fc-btn--raised"
            aria-label={AdminI18n.t(isYearGridOpen ? 'ui.date.nextYears' : 'ui.date.nextYear')}
          >
            <FrameworkIcons.Right size={15} />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {isYearGridOpen
            ? years.map((year) => (
                <button
                  key={year}
                  type="button"
                  onClick={() => this.pickYear(year)}
                  className={cellClasses(year === currentVisibleYear)}
                >
                  {year}
                </button>
              ))
            : DateTimePickerConstants.monthLabels().map((label, monthIndex) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => onJumpMonthSelect(monthIndex)}
                  className={cellClasses(visibleMonth.getMonth() === monthIndex)}
                >
                  {label.slice(0, 3)}
                </button>
              ))}
        </div>
      </div>
    );
  }
}

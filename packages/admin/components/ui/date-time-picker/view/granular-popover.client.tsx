import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop, state, bound } from '@fromcode119/react-class-components';
import type { Ref } from '@fromcode119/react-class-components';
import { FrameworkIcons, RootFramework } from '@fromcode119/react';
import { DateTimePickerGranularity } from '@/components/ui/date-time-picker/enums/date-time-picker-granularity.enum';
import { DateTimePickerConstants } from '@/components/ui/date-time-picker/constants/date-time-picker.constants';
import type { IDateTimePickerCoords } from '@/components/ui/date-time-picker/interfaces/date-time-picker-coords.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The compact popover for MONTH/YEAR granularity: a year strip plus — for months — the 3×4 month
 * grid. Picking commits immediately; there is no day calendar, footer or time chrome.
 */
export class DateTimePickerGranularPopover extends PureReactor {
  @prop declare theme: ThemeMode;
  @prop declare granularity: DateTimePickerGranularity;
  @prop declare selectedYear: number | null;
  @prop declare selectedMonth: number | null;
  @prop declare coords: IDateTimePickerCoords;
  @prop declare popoverRef: Ref<HTMLDivElement>;
  @prop declare onPick: (year: number, monthIndex: number | null) => void;

  /** First year of the visible 12-year page (YEAR granularity only). */
  @state pageStart = 0;
  /** Year whose months are on screen (MONTH granularity only). */
  @state visibleYear = 0;

  componentDidMount(): void {
    const anchor = this.selectedYear ?? new Date().getFullYear();
    this.pageStart = anchor - (anchor % 12);
    this.visibleYear = anchor;
  }

  @bound private shiftPage(offset: number): void {
    if (this.granularity === DateTimePickerGranularity.YEAR) this.pageStart += offset * 12;
    else this.visibleYear += offset;
  }

  private navButton(direction: -1 | 1): ReactNode {
    const Icon = direction < 0 ? FrameworkIcons.Left : FrameworkIcons.Right;
    return (
      <button
        type="button"
        onClick={() => this.shiftPage(direction)}
        className="fc-btn fc-btn--icon fc-btn--raised"
        aria-label={AdminI18n.t(direction < 0 ? 'ui.date.previous' : 'ui.date.next')}
      >
        <Icon size={15} />
      </button>
    );
  }

  /** One chip, the console's button; the picked one takes the primary fill. */
  private cellClasses(isActive: boolean): string {
    return `fc-cal__chip${isActive ? ' fc-cal__chip--on' : ''}`;
  }

  render(): ReactNode {
    const { granularity, coords, popoverRef } = this;
    const isYearMode = granularity === DateTimePickerGranularity.YEAR;
    const years = Array.from({ length: 12 }, (_, index) => this.pageStart + index);

    return (
      <RootFramework>
        <div
          ref={popoverRef}
          style={{ position: 'fixed', top: coords.top, left: coords.left, width: 'min(300px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 24px)', overflowY: 'auto', zIndex: 9999 }}
          className="fc-menu-sheet p-2"
        >
          <div className="mb-2 flex items-center justify-between">
            {this.navButton(-1)}
            <p className="fc-cal__sum-value">
              {isYearMode ? `${this.pageStart} – ${this.pageStart + 11}` : this.visibleYear}
            </p>
            {this.navButton(1)}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {isYearMode
              ? years.map((year) => (
                  <button key={year} type="button" onClick={() => this.onPick(year, null)}
                    className={this.cellClasses(year === this.selectedYear)}>
                    {year}
                  </button>
                ))
              : DateTimePickerConstants.monthLabels().map((label, monthIndex) => (
                  <button key={label} type="button" onClick={() => this.onPick(this.visibleYear, monthIndex)}
                    className={this.cellClasses(this.visibleYear === this.selectedYear && monthIndex === this.selectedMonth)}>
                    {label.slice(0, 3)}
                  </button>
                ))}
          </div>
        </div>
      </RootFramework>
    );
  }
}

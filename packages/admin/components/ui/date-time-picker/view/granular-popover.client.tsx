import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop, state, bound } from '@fromcode119/reactor';
import type { Ref } from '@fromcode119/reactor';
import { FrameworkIcons, RootFramework } from '@fromcode119/react';
import { DateTimePickerGranularity } from '@/components/ui/date-time-picker/enums/date-time-picker-granularity.enum';
import { DateTimePickerConstants } from '@/components/ui/date-time-picker/constants/date-time-picker.constants';
import type { IDateTimePickerCoords } from '@/components/ui/date-time-picker/interfaces/date-time-picker-coords.interface';

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
    const dark = this.theme === ThemeMode.DARK;
    return (
      <button
        type="button"
        onClick={() => this.shiftPage(direction)}
        className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-150 ${
          dark
            ? 'bg-slate-700/40 text-slate-300 hover:bg-indigo-500/20 hover:text-indigo-200 active:scale-95 ring-1 ring-white/5'
            : 'bg-white text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 active:scale-95 shadow-sm ring-1 ring-black/5'
        }`}
        aria-label={direction < 0 ? 'Previous' : 'Next'}
      >
        <Icon size={15} />
      </button>
    );
  }

  private cellClasses(isActive: boolean): string {
    const dark = this.theme === ThemeMode.DARK;
    if (isActive) {
      return dark
        ? 'bg-indigo-500 text-white shadow-xl shadow-indigo-500/30 ring-1 ring-indigo-400/50'
        : 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/25 ring-1 ring-indigo-500/50';
    }
    return dark
      ? 'bg-slate-700/40 text-slate-200 hover:bg-indigo-500/10 hover:text-indigo-300 active:scale-95 ring-1 ring-white/5'
      : 'bg-white text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 active:scale-95 shadow-sm ring-1 ring-black/5';
  }

  render(): ReactNode {
    const { theme, granularity, coords, popoverRef } = this;
    const isYearMode = granularity === DateTimePickerGranularity.YEAR;
    const years = Array.from({ length: 12 }, (_, index) => this.pageStart + index);

    return (
      <RootFramework>
        <div
          ref={popoverRef}
          style={{ position: 'fixed', top: coords.top, left: coords.left, width: 'min(300px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 24px)', overflowY: 'auto', zIndex: 9999 }}
          className={`animate-in zoom-in-95 slide-in-from-top-2 rounded-xl p-4 duration-200 ${
            theme === ThemeMode.DARK
              ? 'bg-slate-900 ring-1 ring-white/10 shadow-2xl shadow-black/50'
              : 'bg-white ring-1 ring-black/10 shadow-2xl shadow-slate-900/20'
          }`}
        >
          <div className="mb-4 flex items-center justify-between">
            {this.navButton(-1)}
            <p className={`text-[15px] font-semibold tracking-tight ${theme === ThemeMode.DARK ? 'text-white' : 'text-slate-900'}`}>
              {isYearMode ? `${this.pageStart} – ${this.pageStart + 11}` : this.visibleYear}
            </p>
            {this.navButton(1)}
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {isYearMode
              ? years.map((year) => (
                  <button key={year} type="button" onClick={() => this.onPick(year, null)}
                    className={`rounded-xl px-3 py-2.5 text-[13px] font-semibold tracking-tight transition-all duration-150 ${this.cellClasses(year === this.selectedYear)}`}>
                    {year}
                  </button>
                ))
              : DateTimePickerConstants.MONTH_LABELS.map((label, monthIndex) => (
                  <button key={label} type="button" onClick={() => this.onPick(this.visibleYear, monthIndex)}
                    className={`rounded-xl px-3 py-2.5 text-[13px] font-semibold tracking-tight transition-all duration-150 ${this.cellClasses(this.visibleYear === this.selectedYear && monthIndex === this.selectedMonth)}`}>
                    {label.slice(0, 3)}
                  </button>
                ))}
          </div>
        </div>
      </RootFramework>
    );
  }
}

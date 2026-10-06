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
    const { theme, visibleMonth, onJumpMonthSelect, isYearGridOpen, pageStart } = this;
    const currentVisibleYear = visibleMonth.getFullYear();
    const years = Array.from({ length: 12 }, (_, index) => pageStart + index);
    const cellClasses = (isActive: boolean): string => isActive
      ? theme === ThemeMode.DARK
        ? 'bg-indigo-500 text-white shadow-xl shadow-indigo-500/30 ring-1 ring-indigo-400/50'
        : 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/25 ring-1 ring-indigo-500/50'
      : theme === ThemeMode.DARK
        ? 'bg-slate-700/40 text-slate-200 hover:bg-indigo-500/10 hover:text-indigo-300 active:scale-95 ring-1 ring-white/5'
        : 'bg-white text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 active:scale-95 shadow-sm ring-1 ring-black/5';

    return (
      <div className={`space-y-5 rounded-xl p-5 ${theme === ThemeMode.DARK ? 'bg-slate-800/40 ring-1 ring-white/5' : 'bg-slate-50/80 ring-1 ring-black/5'}`}>
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => this.shiftNav(-1)}
            className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-150 ${
              theme === ThemeMode.DARK
                ? 'bg-slate-700/40 text-slate-300 hover:bg-indigo-500/20 hover:text-indigo-200 active:scale-95 ring-1 ring-white/5'
                : 'bg-white text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 active:scale-95 shadow-sm ring-1 ring-black/5'
            }`}
            aria-label={AdminI18n.t(isYearGridOpen ? 'ui.date.previousYears' : 'ui.date.previousYear')}
          >
            <FrameworkIcons.Left size={16} />
          </button>
          <div className="text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{AdminI18n.t(isYearGridOpen ? 'ui.date.chooseYear' : 'ui.date.jumpToMonth')}</p>
            <button
              type="button"
              onClick={this.toggleYearGrid}
              aria-label={AdminI18n.t('ui.date.chooseYear')}
              aria-expanded={isYearGridOpen}
              className={`mt-0.5 flex items-center justify-center gap-1.5 rounded-lg px-2 py-0.5 text-[17px] font-semibold tracking-tight transition-all duration-150 ${
                theme === ThemeMode.DARK ? 'text-white hover:bg-indigo-500/20' : 'text-slate-900 hover:bg-indigo-50'
              }`}
            >
              <span>{isYearGridOpen ? `${pageStart} – ${pageStart + 11}` : currentVisibleYear}</span>
              <FrameworkIcons.Down size={14} className={`transition-transform duration-200 ${isYearGridOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => this.shiftNav(1)}
            className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-150 ${
              theme === ThemeMode.DARK
                ? 'bg-slate-700/40 text-slate-300 hover:bg-indigo-500/20 hover:text-indigo-200 active:scale-95 ring-1 ring-white/5'
                : 'bg-white text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 active:scale-95 shadow-sm ring-1 ring-black/5'
            }`}
            aria-label={AdminI18n.t(isYearGridOpen ? 'ui.date.nextYears' : 'ui.date.nextYear')}
          >
            <FrameworkIcons.Right size={16} />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {isYearGridOpen
            ? years.map((year) => (
                <button
                  key={year}
                  type="button"
                  onClick={() => this.pickYear(year)}
                  className={`rounded-xl px-4 py-2.5 text-[13px] font-semibold tracking-tight transition-all duration-150 ${cellClasses(year === currentVisibleYear)}`}
                >
                  {year}
                </button>
              ))
            : DateTimePickerConstants.monthLabels().map((label, monthIndex) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => onJumpMonthSelect(monthIndex)}
                  className={`rounded-xl px-4 py-2.5 text-[13px] font-semibold tracking-tight transition-all duration-150 ${cellClasses(visibleMonth.getMonth() === monthIndex)}`}
                >
                  {label.slice(0, 3)}
                </button>
              ))}
        </div>
      </div>
    );
  }
}

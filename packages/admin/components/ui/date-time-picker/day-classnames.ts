/**
 * Builds the {@link DayPicker} `classNames` map for the date-time picker, themed
 * for light/dark. Extracted verbatim from the picker render to keep the popover
 * component under the file-size limit; the produced styling is identical.
 */
export class DateTimePickerDayClassNames {
  static build(theme: string): Record<string, string> {
    return {
      months: "flex flex-col",
      month: "space-y-4",
      month_caption: "hidden",
      caption_label: "text-sm font-bold text-indigo-600",
      nav: "hidden",
      button_previous: "hidden",
      button_next: "hidden",
      month_grid: "w-full border-separate border-spacing-1",
      weekdays: "mb-1",
      weekday: "h-9 w-11 p-0 text-center align-middle text-slate-400 font-bold text-[10px] uppercase tracking-wider",
      weeks: "",
      week: "",
      day: "h-11 w-11 p-0 text-center align-middle",
      day_button: `flex h-10 w-10 items-center justify-center rounded-xl p-0 font-semibold text-[14px] tracking-tight transition-all duration-150 mx-auto
        ${theme === 'dark'
          ? 'text-slate-100 hover:bg-slate-700/50 hover:scale-105 active:scale-95 [[data-selected=true]_&]:!text-white [[data-today=true]_&]:text-indigo-300 [[data-today=true]_&]:font-bold'
          : 'text-slate-700 hover:bg-slate-100 hover:scale-105 active:scale-95 [[data-selected=true]_&]:!text-white [[data-today=true]_&]:text-indigo-600 [[data-today=true]_&]:font-bold'}`,
      selected: theme === 'dark'
        ? "!bg-indigo-500 hover:!bg-indigo-500 shadow-xl shadow-indigo-500/40 ring-2 ring-indigo-400/50 scale-105"
        : "!bg-indigo-600 hover:!bg-indigo-600 shadow-xl shadow-indigo-600/40 ring-2 ring-indigo-500/60 scale-105",
      today: theme === 'dark'
        ? "ring-2 ring-indigo-400/30"
        : "ring-2 ring-indigo-500/30",
      outside: "pointer-events-none opacity-0",
      disabled: "opacity-20 cursor-not-allowed",
      hidden: "pointer-events-none opacity-0",
    };
  }
}

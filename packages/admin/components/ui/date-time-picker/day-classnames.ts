import { ThemeMode } from '@fromcode119/core/client';

/**
 * The {@link DayPicker} `classNames` map, in the console's own classes.
 *
 * It used to carry a design of its own — 36px cells with a 12px corner, an indigo fill under a ring
 * and a shadow, and cells that grew on hover and shrank on click. None of that exists anywhere else
 * in this console, so the calendar read as a widget borrowed from another product. Every class here
 * now names something `admin.css` draws, which is also why `theme` no longer changes any of them:
 * the tokens already do.
 */
export class DateTimePickerDayClassNames {
  static build(_theme: ThemeMode): Record<string, string> {
    return {
      months: 'flex flex-col',
      month: 'space-y-2',
      month_caption: 'hidden',
      caption_label: 'hidden',
      nav: 'hidden',
      button_previous: 'hidden',
      button_next: 'hidden',
      month_grid: 'fc-cal__grid',
      weekdays: '',
      weekday: 'fc-cal__weekday',
      weeks: '',
      week: '',
      day: 'fc-cal__cell',
      day_button: 'fc-cal__day',
      selected: 'fc-cal--on',
      today: 'fc-cal--today',
      outside: 'pointer-events-none opacity-0',
      disabled: 'opacity-20 cursor-not-allowed',
      hidden: 'pointer-events-none opacity-0',
    };
  }
}

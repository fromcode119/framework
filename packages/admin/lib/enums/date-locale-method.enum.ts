import { Enum } from '@fromcode119/reactor';

/** The native `Date` locale-formatting methods the timezone patcher wraps. */
export class DateLocaleMethod extends Enum {
  static readonly TO_LOCALE_STRING = new DateLocaleMethod('toLocaleString');
  static readonly TO_LOCALE_DATE_STRING = new DateLocaleMethod('toLocaleDateString');
  static readonly TO_LOCALE_TIME_STRING = new DateLocaleMethod('toLocaleTimeString');

  private constructor(value: string) {
    super(value);
  }
}

import { Enum } from '@fromcode119/react-class-components/lang';

/** How a site shows the time of day: follow its language, or a fixed 12- or 24-hour clock. */
export class TimeFormat extends Enum {
  static readonly LOCALE = new TimeFormat('locale');
  static readonly H12 = new TimeFormat('h12');
  static readonly H24 = new TimeFormat('h24');

  private constructor(value: string) {
    super(value);
  }

  /** A stored value; anything unknown (or blank) means "follow the language", the declared default. */
  static resolve(value: unknown): TimeFormat {
    const found = TimeFormat.fromValue(String(value ?? '').trim().toLowerCase());
    return (found as TimeFormat | undefined) ?? TimeFormat.LOCALE;
  }
}

import { Enum } from '@fromcode119/reactor';

/** Which part of a time value an edit targets. */
export class TimePart extends Enum {
  static readonly HOURS = new TimePart('hours');
  static readonly MINUTES = new TimePart('minutes');

  private constructor(value: string) {
    super(value);
  }
}

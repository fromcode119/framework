import { Enum } from '@fromcode119/reactor';

/** Which locale set a localized field edits. */
export class LocaleScope extends Enum {
  static readonly ADMIN = new LocaleScope('admin');
  static readonly FRONTEND = new LocaleScope('frontend');

  private constructor(value: string) {
    super(value);
  }
}

import { Enum } from '@fromcode119/react-class-components';

/** How a list setting is stored: comma separated on one line, or one entry per line. */
export class SettingListSeparator extends Enum {
  static readonly COMMA = new SettingListSeparator(', ');
  static readonly LINE = new SettingListSeparator('\n');

  private constructor(value: string) {
    super(value);
  }
}

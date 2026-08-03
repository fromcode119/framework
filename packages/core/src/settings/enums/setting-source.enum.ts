import { Enum } from '@fromcode119/reactor';

/** Where a resolved setting value came from. */
export class SettingSource extends Enum {
  static readonly STORED = new SettingSource('stored');
  static readonly ENV = new SettingSource('env');
  static readonly DEFAULT = new SettingSource('default');

  private constructor(value: string) {
    super(value);
  }
}

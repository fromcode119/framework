import { Enum } from '@fromcode119/react-class-components';

/** Which theme asset directory a request targets. */
export class ThemeAssetScope extends Enum {
  static readonly PUBLIC = new ThemeAssetScope('public');
  static readonly UI = new ThemeAssetScope('ui');

  private constructor(value: string) {
    super(value);
  }
}

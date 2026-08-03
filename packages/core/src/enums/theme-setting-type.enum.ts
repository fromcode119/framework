import { Enum } from '@fromcode119/reactor';

/** Control type of a theme setting (themes author this as a wire string). */
export class ThemeSettingType extends Enum {
  static readonly COLOR = new ThemeSettingType('color');
  static readonly TEXT = new ThemeSettingType('text');
  static readonly NUMBER = new ThemeSettingType('number');
  static readonly SELECT = new ThemeSettingType('select');
  static readonly FONT = new ThemeSettingType('font');
  static readonly IMAGE = new ThemeSettingType('image');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw plugin/theme/wire string to a member; defaults to TEXT. */
  static resolve(value: unknown): ThemeSettingType {
    if (value instanceof ThemeSettingType) return value;
    const found = ThemeSettingType.fromValue(String(value ?? '').trim());
    return (found as ThemeSettingType | undefined) ?? ThemeSettingType.TEXT;
  }
}

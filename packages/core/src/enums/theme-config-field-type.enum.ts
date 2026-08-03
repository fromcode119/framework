import { Enum } from '@fromcode119/reactor';

/** Control type of a theme config field. */
export class ThemeConfigFieldType extends Enum {
  static readonly TEXT = new ThemeConfigFieldType('text');
  static readonly NUMBER = new ThemeConfigFieldType('number');
  static readonly BOOLEAN = new ThemeConfigFieldType('boolean');
  static readonly SELECT = new ThemeConfigFieldType('select');
  static readonly INTEGRATION = new ThemeConfigFieldType('integration');
  static readonly JSON = new ThemeConfigFieldType('json');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw plugin/theme/wire string to a member; defaults to TEXT. */
  static resolve(value: unknown): ThemeConfigFieldType {
    if (value instanceof ThemeConfigFieldType) return value;
    const found = ThemeConfigFieldType.fromValue(String(value ?? '').trim());
    return (found as ThemeConfigFieldType | undefined) ?? ThemeConfigFieldType.TEXT;
  }
}

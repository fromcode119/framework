import { Enum } from '@fromcode119/reactor';

/** Where a field renders in the admin edit layout. */
export class FieldPosition extends Enum {
  static readonly SIDEBAR = new FieldPosition('sidebar');
  static readonly MAIN = new FieldPosition('main');

  private constructor(value: string) {
    super(value);
  }

  /**
   * Resolve a raw value to a member; defaults to MAIN.
   *
   * Collections declare this as a literal (`position: 'sidebar'`) and it arrives at the admin as JSON, so
   * a raw string is what consumers actually hold — comparing that to a member with `===` is always false.
   */
  static resolve(value: unknown): FieldPosition {
    if (value instanceof FieldPosition) return value;
    const found = FieldPosition.fromValue(String(value ?? '').trim().toLowerCase());
    return (found as FieldPosition | undefined) ?? FieldPosition.MAIN;
  }
}

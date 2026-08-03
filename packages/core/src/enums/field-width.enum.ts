import { Enum } from '@fromcode119/reactor';

/** How wide a field renders in the admin form. */
export class FieldWidth extends Enum {
  static readonly FULL = new FieldWidth('full');
  static readonly HALF = new FieldWidth('half');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw plugin/wire string to a member; defaults to FULL. */
  static resolve(value: unknown): FieldWidth {
    if (value instanceof FieldWidth) return value;
    const found = FieldWidth.fromValue(String(value ?? '').trim());
    return (found as FieldWidth | undefined) ?? FieldWidth.FULL;
  }
}

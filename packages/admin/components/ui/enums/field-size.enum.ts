import { Enum } from '@fromcode119/reactor';

/** Size variant of an admin form control. Indexes the size lookups in `UiFieldUtils.FIELD.sizes`. */
export class FieldSize extends Enum {
  static readonly SM = new FieldSize('sm');
  static readonly MD = new FieldSize('md');
  static readonly LG = new FieldSize('lg');
  static readonly ICON = new FieldSize('icon');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw string to a member; defaults to MD. */
  static resolve(value: unknown): FieldSize {
    if (value instanceof FieldSize) return value;
    const found = FieldSize.fromValue(String(value ?? '').trim().toLowerCase());
    return (found as FieldSize | undefined) ?? FieldSize.MD;
  }
}

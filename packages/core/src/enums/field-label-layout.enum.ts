import { Enum } from '@fromcode119/reactor';

/** How a field renders its label relative to the control. */
export class FieldLabelLayout extends Enum {
  static readonly INLINE = new FieldLabelLayout('inline');
  static readonly LABEL_ROW = new FieldLabelLayout('label-row');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw string to a member; defaults to INLINE. */
  static resolve(value: unknown): FieldLabelLayout {
    if (value instanceof FieldLabelLayout) return value;
    const found = FieldLabelLayout.fromValue(String(value ?? '').trim().toLowerCase());
    return (found as FieldLabelLayout | undefined) ?? FieldLabelLayout.INLINE;
  }
}

import { Enum } from '@fromcode119/react-class-components/lang';

/**
 * How often an operator needs a field, declared by the collection that owns it.
 *
 * The edit form opens on the everyday fields and names how many more it holds; the operator widens it
 * to the occasional ones, then to the technical ones. Nothing is hidden: a wider view is one click
 * away, and a field that is required and empty, or carries an error, is shown at every depth.
 *
 * An undeclared field is EVERYDAY, so a collection that declares no levels reads exactly as before.
 */
export class FieldLevel extends Enum {
  static readonly EVERYDAY = new FieldLevel('everyday', 0);
  static readonly OCCASIONAL = new FieldLevel('occasional', 1);
  static readonly TECHNICAL = new FieldLevel('technical', 2);

  /** Narrowest first — the order the depth switch offers them in. */
  static readonly ordered: readonly FieldLevel[] = [FieldLevel.EVERYDAY, FieldLevel.OCCASIONAL, FieldLevel.TECHNICAL];

  /** Position in the widening order: a view of depth N shows every field ranked N or below. */
  readonly rank: number;

  private constructor(value: string, rank: number) {
    super(value);
    this.rank = rank;
  }

  /** Resolve a raw plugin/wire string to a member; defaults to EVERYDAY. */
  static resolve(value: unknown): FieldLevel {
    if (value instanceof FieldLevel) return value;
    const found = FieldLevel.fromValue(String(value ?? '').trim());
    return (found as FieldLevel | undefined) ?? FieldLevel.EVERYDAY;
  }
}

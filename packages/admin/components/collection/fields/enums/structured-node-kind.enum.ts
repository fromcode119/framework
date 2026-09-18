import { Enum } from '@fromcode119/react-class-components';

/**
 * What a node in a structured read-only field turned out to be.
 *
 * The shape decides the renderer: a flat array of like objects becomes a TABLE, an uneven one a list,
 * and a scalar or an absent value a single row. Declared rather than written inline at the interface
 * so the renderer branches on members instead of on string literals — which is the same reason every
 * other option set here is an `Enum`.
 */
export class StructuredNodeKind extends Enum {
  /** A map of keys to further nodes. */
  static readonly OBJECT = new StructuredNodeKind('object');
  /** A list whose items are not uniform enough to tabulate. */
  static readonly ARRAY = new StructuredNodeKind('array');
  /** A list of like objects, rendered as columns and rows. */
  static readonly ARRAY_TABLE = new StructuredNodeKind('array-table');
  /** A single value with nothing beneath it. */
  static readonly SCALAR = new StructuredNodeKind('scalar');
  /**
   * Nothing to show.
   *
   * A distinct member rather than an absent node, because "the operator stored nothing here" and
   * "this key does not exist" read the same on screen and are not the same fact — a table cell with
   * no value still has to occupy its column.
   */
  static readonly EMPTY = new StructuredNodeKind('empty');

  private constructor(value: string) {
    super(value);
  }

  /**
   * Resolve a raw value to a member; anything unrecognised is EMPTY.
   *
   * Rows still carry values written before this field existed, and a shape this code cannot name is
   * closer to "nothing to show" than to any of the others — rendering an unknown kind as a broken
   * group is worse than rendering it as absent.
   */
  static resolve(value: unknown): StructuredNodeKind {
    if (value instanceof StructuredNodeKind) return value;
    const found = StructuredNodeKind.fromValue(String(value ?? '').trim().toLowerCase());
    return (found as StructuredNodeKind | undefined) ?? StructuredNodeKind.EMPTY;
  }
}

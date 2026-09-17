import { Enum } from '@fromcode119/react-class-components';

/**
 * Where the value a field SHOWS actually came from.
 *
 * The three are what keeps this screen out of Rule Zero trouble: `OWN` is the record's own value,
 * `INHERITED` is empty-but-a-setting-decides (and the field must say WHICH setting and link to it),
 * and `NONE` is empty-and-nothing-renders. Confusing the last two is exactly the failure the field
 * provenance work exists to prevent — an operator being shown a value no field of theirs produced.
 */
export class FieldProvenanceKind extends Enum {
  /** The record's own value. */
  static readonly OWN = new FieldProvenanceKind('own');

  /** Empty here; a declared setting supplies it, and the field names that setting. */
  static readonly INHERITED = new FieldProvenanceKind('inherited');

  /** Empty, and nothing renders. */
  static readonly NONE = new FieldProvenanceKind('none');

  private constructor(value: string) {
    super(value);
  }
}

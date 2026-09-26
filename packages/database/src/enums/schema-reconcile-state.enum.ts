import { Enum } from '@fromcode119/react-class-components/lang';

/**
 * How one attempt to reconcile a declared schema against the live table ended.
 *
 * Four outcomes, and the difference between them is what the migration log reports: `SATISFIED` is
 * silence, `CHANGED` is a line saying what moved, `UNSUPPORTED` is a dialect that cannot express the
 * declaration, and `FAILED` is the one an operator has to act on. Collapsing any two of them would
 * make a real failure read as routine noise.
 */
export class SchemaReconcileState extends Enum {
  /** The driver altered the table to match the declaration. */
  static readonly CHANGED = new SchemaReconcileState('changed');

  /** Already true — nothing to do. */
  static readonly SATISFIED = new SchemaReconcileState('satisfied');

  /** The driver tried and could not. */
  static readonly FAILED = new SchemaReconcileState('failed');

  /** This dialect has no way to express the declaration. */
  static readonly UNSUPPORTED = new SchemaReconcileState('unsupported');

  private constructor(value: string) {
    super(value);
  }
}

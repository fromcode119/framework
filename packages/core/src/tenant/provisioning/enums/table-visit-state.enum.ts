import { Enum } from '@fromcode119/react-class-components';

/**
 * How far the dependency-order walk has got with one table.
 *
 * `VISITING` is what makes a cycle survivable: a table reached while it is still being visited is a
 * loop, and the walk lets whichever table came first go first rather than recursing forever. Without
 * the distinction from `DONE` a self-referencing schema would hang the import.
 */
export class TableVisitState extends Enum {
  /** On the stack — reaching it again is a cycle. */
  static readonly VISITING = new TableVisitState('visiting');

  /** Already placed in the order. */
  static readonly DONE = new TableVisitState('done');

  private constructor(value: string) {
    super(value);
  }
}

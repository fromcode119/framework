import { Enum } from '@fromcode119/reactor';

/** ORDER BY direction. The `.value` is emitted straight into SQL. */
export class SortDirection extends Enum {
  static readonly ASC = new SortDirection('ASC');
  static readonly DESC = new SortDirection('DESC');

  private constructor(value: string) {
    super(value);
  }
}

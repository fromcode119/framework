import { Enum } from '@fromcode119/reactor';

/** Direction a column is moved in the columns menu. */
export class ReorderDirection extends Enum {
  static readonly UP = new ReorderDirection('up');
  static readonly DOWN = new ReorderDirection('down');

  private constructor(value: string) {
    super(value);
  }
}

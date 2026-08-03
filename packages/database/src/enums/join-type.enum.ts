import { Enum } from '@fromcode119/reactor';

/** SQL JOIN flavour. */
export class JoinType extends Enum {
  static readonly INNER = new JoinType('inner');
  static readonly LEFT = new JoinType('left');

  private constructor(value: string) {
    super(value);
  }
}

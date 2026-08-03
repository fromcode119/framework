import { Enum } from '@fromcode119/reactor';

/** A mutating collection operation subject to access policy. */
export class WriteOperation extends Enum {
  static readonly CREATE = new WriteOperation('create');
  static readonly UPDATE = new WriteOperation('update');
  static readonly DELETE = new WriteOperation('delete');

  private constructor(value: string) {
    super(value);
  }
}

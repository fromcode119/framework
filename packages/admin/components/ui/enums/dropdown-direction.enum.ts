import { Enum } from '@fromcode119/reactor';

/** Which way a dropdown/menu opens relative to its trigger. */
export class DropdownDirection extends Enum {
  static readonly UP = new DropdownDirection('up');
  static readonly DOWN = new DropdownDirection('down');

  private constructor(value: string) {
    super(value);
  }
}

import { Enum } from '@fromcode119/reactor';

/** Style variant of a dropdown menu item. */
export class DropdownItemVariant extends Enum {
  static readonly DEFAULT = new DropdownItemVariant('default');
  static readonly DANGER = new DropdownItemVariant('danger');

  private constructor(value: string) {
    super(value);
  }
}

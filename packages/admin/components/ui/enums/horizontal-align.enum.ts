import { Enum } from '@fromcode119/react-class-components';

/** Horizontal alignment / indent direction for admin UI elements. */
export class HorizontalAlign extends Enum {
  static readonly LEFT = new HorizontalAlign('left');
  static readonly RIGHT = new HorizontalAlign('right');

  private constructor(value: string) {
    super(value);
  }
}

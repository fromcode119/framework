import { Enum } from '@fromcode119/reactor';

/** Accent colour of the admin page footer. */
export class FooterAccent extends Enum {
  static readonly INDIGO = new FooterAccent('indigo');
  static readonly EMERALD = new FooterAccent('emerald');

  private constructor(value: string) {
    super(value);
  }
}

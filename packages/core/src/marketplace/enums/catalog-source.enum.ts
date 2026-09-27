import { Enum } from '@fromcode119/react-class-components/lang';

/** Where a catalogue offer comes from. Only an offer this installation built itself is marked. */
export class CatalogSource extends Enum {
  /** Built by this installation and waiting on its own disk — never downloaded from a URL. */
  static readonly LOCAL = new CatalogSource('local');

  private constructor(value: string) {
    super(value);
  }
}

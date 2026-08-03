import { Enum } from '@fromcode119/reactor';

/** Which textual control a collection field renders. */
export class TextualFieldKind extends Enum {
  static readonly TEXTAREA = new TextualFieldKind('textarea');
  static readonly JSON = new TextualFieldKind('json');
  static readonly PASSWORD = new TextualFieldKind('password');

  private constructor(value: string) {
    super(value);
  }
}

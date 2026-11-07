import { Enum } from '@fromcode119/react-class-components/lang';

/** Which way a language's text runs — the value `<html dir>` takes. */
export class TextDirection extends Enum {
  static readonly LTR = new TextDirection('ltr');
  static readonly RTL = new TextDirection('rtl');

  private constructor(value: string) {
    super(value);
  }
}

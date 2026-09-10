import { Enum } from '@fromcode119/react-class-components';

/** Suggested next step surfaced in the assistant UI. */
export class NextStep extends Enum {
  static readonly REPLY = new NextStep('reply');
  static readonly PREVIEW = new NextStep('preview');
  static readonly APPLY = new NextStep('apply');
  static readonly NONE = new NextStep('none');

  private constructor(value: string) {
    super(value);
  }
}

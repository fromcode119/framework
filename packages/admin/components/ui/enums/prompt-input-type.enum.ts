import { Enum } from '@fromcode119/reactor';

/** Input type used by the prompt dialog. */
export class PromptInputType extends Enum {
  static readonly TEXT = new PromptInputType('text');
  static readonly PASSWORD = new PromptInputType('password');

  private constructor(value: string) {
    super(value);
  }
}

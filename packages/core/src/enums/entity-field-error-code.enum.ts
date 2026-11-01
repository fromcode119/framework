import { Enum } from '@fromcode119/react-class-components/lang';

/** Why a collection field was refused — sent beside the English message so a reader can say it in its own language. */
export class EntityFieldErrorCode extends Enum {
  static readonly REQUIRED = new EntityFieldErrorCode('required');

  private constructor(value: string) {
    super(value);
  }
}

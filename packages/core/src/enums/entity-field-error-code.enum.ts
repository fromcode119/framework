import { Enum } from '@fromcode119/react-class-components/lang';

/** Why a field was refused — sent beside the English message so a reader can say it in its own language. */
export class EntityFieldErrorCode extends Enum {
  static readonly REQUIRED = new EntityFieldErrorCode('required');
  static readonly NOT_A_NUMBER = new EntityFieldErrorCode('notANumber');
  static readonly BELOW_MIN = new EntityFieldErrorCode('belowMin');
  static readonly ABOVE_MAX = new EntityFieldErrorCode('aboveMax');
  static readonly NOT_AN_EMAIL = new EntityFieldErrorCode('notAnEmail');
  static readonly NOT_A_URL = new EntityFieldErrorCode('notAUrl');
  static readonly NOT_AN_OPTION = new EntityFieldErrorCode('notAnOption');

  private constructor(value: string) {
    super(value);
  }
}

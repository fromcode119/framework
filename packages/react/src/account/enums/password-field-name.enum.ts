import { Enum } from '@fromcode119/reactor';

/** Which password input the security panel is toggling. */
export class PasswordFieldName extends Enum {
  static readonly CURRENT_PASSWORD = new PasswordFieldName('currentPassword');
  static readonly NEW_PASSWORD = new PasswordFieldName('newPassword');

  private constructor(value: string) {
    super(value);
  }
}

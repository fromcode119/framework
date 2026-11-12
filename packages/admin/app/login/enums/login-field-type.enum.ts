import { Enum } from '@fromcode119/react-class-components';

/** The kinds of input a signed-out screen asks for. */
export class LoginFieldType extends Enum {
  static readonly EMAIL = new LoginFieldType('email');
  static readonly PASSWORD = new LoginFieldType('password');
  static readonly TEXT = new LoginFieldType('text');
}

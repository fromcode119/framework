import { Enum } from '@fromcode119/react-class-components';

/** Whether a signed-out screen's notice reports a problem or a success. */
export class LoginNoticeTone extends Enum {
  static readonly ERROR = new LoginNoticeTone('error');
  static readonly OK = new LoginNoticeTone('ok');
}

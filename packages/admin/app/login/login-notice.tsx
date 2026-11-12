import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';

import { LoginNoticeTone } from '@/app/login/enums/login-notice-tone.enum';

/** A message above a signed-out form: what went wrong, or that a request was sent. Announced to screen readers. */
export class LoginNotice extends PureReactor {
  declare props: Pick<LoginNotice, 'message' | 'tone'>;

  @prop declare message: string;
  @prop declare tone: LoginNoticeTone;

  render(): ReactNode {
    if (!this.message) return null;
    const ok = this.tone === LoginNoticeTone.OK;
    return (
      <div className={`fc-login__notice${ok ? ' fc-login__notice--ok' : ' fc-login__error'}`} role={ok ? 'status' : 'alert'}>
        {ok ? <FrameworkIcons.CheckCircle size={17} /> : <FrameworkIcons.Alert size={17} />}
        <span>{this.message}</span>
      </div>
    );
  }
}

import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';

/** The heading and one line under it, for every signed-out screen. The page decides the words. */
export class LoginPageHeader extends PureReactor {
  declare props: Pick<LoginPageHeader, 'title' | 'subtitle'>;

  @prop declare title: string;
  @prop declare subtitle?: string;

  render(): ReactNode {
    return (
      <div className="fc-login__header">
        <h1 className="fc-login__title">{this.title}</h1>
        {this.subtitle ? <p className="fc-login__subtitle">{this.subtitle}</p> : null}
      </div>
    );
  }
}

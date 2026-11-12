import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';

/** The one primary button of a signed-out screen; while busy it keeps its words and shows a spinner. */
export class LoginSubmit extends PureReactor {
  declare props: Pick<LoginSubmit, 'label' | 'isLoading'>;

  @prop declare label: string;
  @prop declare isLoading: boolean;

  render(): ReactNode {
    return (
      <button type="submit" className="fc-login__submit" disabled={this.isLoading} aria-busy={this.isLoading}>
        {this.isLoading ? <FrameworkIcons.Loader size={18} className="fc-login__spinner" aria-hidden="true" /> : null}
        {this.label}
      </button>
    );
  }
}

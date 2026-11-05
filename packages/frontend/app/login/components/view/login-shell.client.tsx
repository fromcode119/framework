import { Reactor, prop } from '@fromcode119/react-class-components';
import { AuthMode } from '@fromcode119/react/auth/enums/auth-mode.enum';
import { AuthShellImplementation } from '@fromcode119/react/auth/auth-shell-implementation';

/**
 * The framework's sign-in shell on its own route. A client boundary: the shell is a class component
 * that reads the browser session, and a server page cannot import it directly.
 */
export class LoginShell extends Reactor {
  /** The locale the route resolved, so the server paints the same words the browser will. */
  @prop declare documentLocale?: string;

  render() {
    return <AuthShellImplementation mode={AuthMode.LOGIN} documentLocale={this.documentLocale} />;
  }
}

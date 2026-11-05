import { Reactor } from '@fromcode119/react-class-components';
import { AccountShellImplementation } from '@fromcode119/react/account/account-shell-implementation';

/**
 * The framework's account shell on its own route. A client boundary: the shell reads the browser
 * session and the registered account sections, and a server page cannot import it directly.
 */
export class AccountShellHost extends Reactor {
  render() {
    return <AccountShellImplementation />;
  }
}

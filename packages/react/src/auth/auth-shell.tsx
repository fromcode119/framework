import { prop } from '@fromcode119/react-class-components';
import { ShellBoundary } from '@react/view/shell-boundary';
import { ShellImplementation } from '@react/shell-implementation';
import type { AuthMode } from '@react/auth/enums/auth-mode.enum';

/**
 * The framework-default auth page (login / register / forgot-password / reset-password), rendered
 * inside its Suspense boundary. The surface itself is `AuthShellImplementation` — static on the server,
 * code-split in the browser; see `ShellBoundary` for why the boundary lives on this class.
 *
 * The active surface comes from the `mode` prop, else from the URL path — mirroring how AccountShell
 * reads its section. Both props reach the implementation unchanged.
 */
export class AuthShell extends ShellBoundary {
  /** Filled by `AuthShellImplementation` on evaluation; the browser bridge swaps in its lazy twin. */
  static readonly implementation = new ShellImplementation();

  @prop declare page?: any;

  /** Overrides URL-based detection of the surface. */
  @prop declare mode?: AuthMode;

  protected get shellImplementation(): ShellImplementation {
    return AuthShell.implementation;
  }
}

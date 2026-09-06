import { ShellBoundary } from '@react/view/shell-boundary';
import { ShellImplementation } from '@react/shell-implementation';

/**
 * The token-authenticated email-preferences screen (the unsubscribe link's destination), rendered
 * inside its Suspense boundary. The surface itself is `TokenEmailPreferencesPanelImplementation` —
 * static on the server, code-split in the browser; see `ShellBoundary` for why the boundary lives on
 * this class. It takes no props: the signed token in the URL is read by the implementation itself.
 */
export class TokenEmailPreferencesPanel extends ShellBoundary {
  /** Filled by `TokenEmailPreferencesPanelImplementation` on evaluation; the browser bridge swaps in its lazy twin. */
  static readonly implementation = new ShellImplementation();

  protected get shellImplementation(): ShellImplementation {
    return TokenEmailPreferencesPanel.implementation;
  }
}

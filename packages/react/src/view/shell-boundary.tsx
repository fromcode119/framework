import type { ReactNode } from 'react';
import { Reactor, ReactPrimitives } from '@fromcode119/reactor';
import { ShellImplementation } from '@react/shell-implementation';

/**
 * A framework shell's Suspense boundary — the part of a route-level shell that is the same on the
 * server and in the browser.
 *
 * The shells are code-split in the browser (`RuntimeBridgeStaticRefs.shells()` swaps each boundary's
 * implementation for a `React.lazy`), while the server renders the static implementation. Before this
 * class the Suspense boundary lived only in the browser's wrapper, so the server tree had no boundary
 * where the client tree had one — a structural mismatch that forces a root-level client re-render of
 * `/account` and `/login` under `hydrateRoot`. With the boundary on the shell class itself, both sides
 * render `Shell → Suspense → implementation`, `renderToString` emits the `<!--$-->` markers the browser
 * expects, and the lazy chunk hydrates INTO the server's markup instead of replacing it.
 *
 * Every prop reaches the implementation unchanged; the boundary adds nothing of its own.
 */
export abstract class ShellBoundary extends Reactor {
  /** The holder the concrete shell owns as a static — see {@link ShellImplementation}. */
  protected abstract get shellImplementation(): ShellImplementation;

  /**
   * What stands in the boundary while a code-split implementation is still loading. Null by default;
   * a shell whose absence would leave a hole in the page (the account) supplies its own shape.
   */
  protected get fallback(): ReactNode {
    return null;
  }

  /** In the browser only (a server render never mounts): freeze the child type this boundary rendered with. */
  componentDidMount(): void {
    this.shellImplementation.pin();
  }

  render(): ReactNode {
    const Implementation = this.shellImplementation.component;
    if (!Implementation) {
      // Loud, never silent: an empty boundary would ship a page with a hole and no message. The
      // implementation module registers itself on evaluation, so this means it was never imported.
      throw new Error(`[react] ${this.constructor.name}: no implementation registered — import its implementation module or replace() one before rendering.`);
    }
    return (
      <ReactPrimitives.Suspense fallback={this.fallback}>
        <Implementation {...this.props} />
      </ReactPrimitives.Suspense>
    );
  }
}

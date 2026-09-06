import type { ComponentType } from 'react';

/**
 * Which component a framework shell boundary (`AccountShell`, `AuthShell`, `RecordsHub`,
 * `TokenEmailPreferencesPanel`) renders inside its Suspense boundary. One holder per shell, owned by
 * the boundary class as a static.
 *
 * Two writers, deliberately asymmetric:
 *
 * - The shell's STATIC implementation module registers itself as the default when it is evaluated
 *   (`provideDefault`, first registration wins). Wherever the module graph includes it — the built
 *   `@fromcode119/react` package the server renders with, a direct import — the boundary renders the real
 *   thing with no wiring step, and the server emits the same `<!--$-->` boundary the browser tree has.
 * - The BROWSER bridge replaces it with a code-split `React.lazy` of that same module (`replace`), at
 *   install and before any theme renders, so a storefront page that renders no shell never parses the
 *   account/auth/records UI. React 19 keeps the server's markup on screen inside the dehydrated boundary
 *   until the chunk lands, then hydrates it in place.
 *
 * `replace` wins over `provideDefault` (a lazily loaded implementation module evaluates AFTER the bridge
 * installed the lazy, and letting its default take over would hand React a second component type for
 * the same shell), but ONLY until a boundary has MOUNTED with the component (`pin`, called from the
 * boundary's `componentDidMount`). Without the pin, the admin — where the bridge installs on an effect
 * AFTER first paint — swapped the child type of an already-mounted shell on its next render: an unmount
 * + remount that refired `componentDidMount` (RecordsHub refetched, panel state was lost). A server
 * render never mounts, so it never pins: the same process can render the static implementation for the
 * server and still install the lazy for the browser (the parity test does exactly that).
 */
export class ShellImplementation {
  private current: ComponentType<any> | null = null;

  /** Set by the first boundary that MOUNTS: its child type never changes underneath it. */
  private pinned = false;

  /**
   * Register the static implementation. A no-op once anything is set. Returns `true` so it can sit in
   * a static field initialiser of the implementation class, which is what runs it on module evaluation.
   */
  provideDefault(component: ComponentType<any>): boolean {
    this.current ||= component;
    return true;
  }

  /** The browser bridge's code-split swap. A no-op once a boundary has rendered the holder's component. */
  replace(component: ComponentType<any>): void {
    if (this.pinned) return;
    this.current = component;
  }

  /** A boundary mounted with the current component; from here on `replace` is a no-op. */
  pin(): void {
    if (this.current) this.pinned = true;
  }

  /** The component the boundary renders, or null when no implementation module has been evaluated. */
  get component(): ComponentType<any> | null {
    return this.current;
  }
}

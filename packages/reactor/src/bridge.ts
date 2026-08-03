import { createElement } from 'react';
import type { ReactNode } from 'react';
import { Reactor } from './reactor';

/**
 * The ONE sanctioned place a React hook may be called, so every component above it stays a class.
 *
 * Some values are only reachable through a hook — a router (`useRouter`, `usePathname`), a third-party
 * context, `useSyncExternalStore`-backed state. A class component cannot call those. Rather than let a
 * bare `export function` shim leak into the framework for each one, subclass `Bridge`: put the hook calls
 * in `read()` and the markup in `present(values)`, both ordinary methods.
 *
 *   export class AuthProvider extends Bridge {
 *     @prop declare children: ReactNode;
 *     protected read() { return { router: useRouter() }; }
 *     protected present({ router }) { return <AuthProviderView router={router}>{this.children}</AuthProviderView>; }
 *   }
 *
 * A second type argument types `this.props` for the rare bridge that forwards a whole prop bag straight
 * through to its view (`<View {...this.props} extra={value} />`); prefer `@prop` fields otherwise.
 *
 * `read()` runs inside an internal function component, invoked unconditionally on every render — so the
 * Rules of Hooks hold exactly as they would in a hand-written shim. Keep `read()` to hook calls only;
 * anything derived belongs in `present()` or a getter.
 */
export abstract class Bridge<V = Record<string, unknown>, P = Record<string, unknown>> extends Reactor<P> {
  /** Call the hooks here and return their values. Runs in a function-component context. */
  protected abstract read(): V;

  /** Render from the values `read()` produced. No hooks here — this runs on the class instance. */
  protected abstract present(values: V): ReactNode;

  /** The internal function component that owns the hook call. The only function in the OOP stack. */
  private static Host<V>(props: { read: () => V; present: (values: V) => ReactNode }): ReactNode {
    return props.present(props.read());
  }

  render(): ReactNode {
    return createElement(Bridge.Host<V>, {
      read: () => this.read(),
      present: (values: V) => this.present(values),
    });
  }
}

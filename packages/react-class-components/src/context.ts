import * as React from 'react';
import type { Context as ReactContext } from 'react';

/**
 * OOP wrapper around `React.createContext`, so no bare `createContext` calls live in app code.
 * Pair it with {@link Provider} to publish a value and read it via a component's `static
 * contextType = MyContext.raw`.
 *
 *   export const ThemeContext = new Context('light');   // type inferred from the default
 *
 * React is taken as a NAMESPACE and `createContext` reached through it at construction time, rather
 * than imported by name. The named form put `createContext` in this module's static import list, and
 * because the package index re-exports this class, EVERY consumer of reactor inherited it — including
 * the admin's middleware, which reaches reactor through `admin-path` for a single `Platform.isBrowser`
 * check. Next then refuses the whole graph: "You're importing a module that depends on `createContext`
 * into a React Server Component module". `next build` tolerated it and `next dev` did not, which made
 * the admin's dev server unusable and forced a full image rebuild for every change.
 *
 * Nothing about the runtime changes: `createContext` still runs when a Context is constructed, which
 * only ever happens in client code.
 */
export class Context<T> {
  readonly raw: ReactContext<T>;

  constructor(defaultValue: T) {
    this.raw = React.createContext<T>(defaultValue);
  }
}

import { createContext } from 'react';
import type { Context as ReactContext } from 'react';

/**
 * OOP wrapper around `React.createContext`, so no bare `createContext` calls live in app code.
 * Pair it with {@link Provider} to publish a value and read it via a component's `static
 * contextType = MyContext.raw`.
 *
 *   export const ThemeContext = new Context('light');   // type inferred from the default
 */
export class Context<T> {
  readonly raw: ReactContext<T>;

  constructor(defaultValue: T) {
    this.raw = createContext<T>(defaultValue);
  }
}

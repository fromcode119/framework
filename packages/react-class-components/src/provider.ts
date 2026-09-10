import { createElement } from 'react';
import type { ReactNode } from 'react';
import { Reactor } from './reactor';
import { Context } from './context';

/**
 * Base class for context providers — the OOP replacement for a functional `<Ctx.Provider>` wrapper.
 * Subclasses name their {@link Context} and compute the published value; `render` wires the raw
 * Provider. Because it extends {@link Reactor}, the value can come from reactive `@state`.
 *
 *   export class ThemeProvider extends Provider {     // no generic
 *     protected readonly channel = ThemeContext;
 *     @state private theme = 'light';
 *     protected value() { return this.theme; }
 *   }
 *
 * The field is `channel`, not `context` — `this.context` is reserved by React.Component for the
 * value a component *consumes*, and React overwrites it at render time.
 */
export abstract class Provider extends Reactor<{ children?: ReactNode }> {
  protected abstract readonly channel: Context<any>;

  /** The value published to descendants; recomputed on every render. */
  protected abstract value(): unknown;

  render(): ReactNode {
    return createElement(this.channel.raw.Provider, { value: this.value() }, this.props.children);
  }
}

import { Reactor } from './reactor';

/**
 * A `Reactor` that only re-renders when props or state shallow-change — the OOP replacement for
 * `React.memo` / `React.PureComponent`. Extend this instead of wrapping a component in `memo()`.
 *
 *   export class PriceTag extends PureReactor<{ amount: number }> { ... }
 */
export abstract class PureReactor<P = Record<string, unknown>, S = Record<string, unknown>>
  extends Reactor<P, S> {
  shouldComponentUpdate(nextProps: Readonly<P>, nextState: Readonly<S>): boolean {
    return !PureReactor.shallowEqual(this.props, nextProps) || !PureReactor.shallowEqual(this.state, nextState);
  }

  private static shallowEqual(a: unknown, b: unknown): boolean {
    if (Object.is(a, b)) return true;
    if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false;
    const aRecord = a as Record<string, unknown>;
    const bRecord = b as Record<string, unknown>;
    const aKeys = Object.keys(aRecord);
    if (aKeys.length !== Object.keys(bRecord).length) return false;
    for (let i = 0; i < aKeys.length; i++) {
      const key = aKeys[i];
      // keys come from `a` and lengths match, so a mismatched key in `b` reads as undefined → not `Object.is`
      if (!Object.is(aRecord[key], bRecord[key])) return false;
    }
    return true;
  }
}

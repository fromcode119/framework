import { Enum } from '@fromcode119/reactor';

/** Model-routing strategy. */
export class RouterStrategy extends Enum {
  static readonly CHEAP_DISCOVERY = new RouterStrategy('cheap_discovery');
  static readonly BALANCED = new RouterStrategy('balanced');
  static readonly PREMIUM = new RouterStrategy('premium');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw string to a member; defaults to BALANCED. */
  static resolve(value: unknown): RouterStrategy {
    if (value instanceof RouterStrategy) return value;
    const found = RouterStrategy.fromValue(String(value ?? '').trim());
    return (found as RouterStrategy | undefined) ?? RouterStrategy.BALANCED;
  }
}

import { Enum } from '@fromcode119/reactor';

/** Relative model cost. */
export class CostTier extends Enum {
  static readonly CHEAP = new CostTier('cheap');
  static readonly MODERATE = new CostTier('moderate');
  static readonly EXPENSIVE = new CostTier('expensive');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a wire/stored string to a member; defaults to CHEAP. */
  static resolve(value: unknown): CostTier {
    if (value instanceof CostTier) return value;
    const found = CostTier.fromValue(String(value ?? '').trim());
    return (found as unknown as CostTier | undefined) ?? CostTier.CHEAP;
  }
}

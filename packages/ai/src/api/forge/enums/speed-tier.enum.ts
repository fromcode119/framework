import { Enum } from '@fromcode119/reactor';

/** Relative model speed. */
export class SpeedTier extends Enum {
  static readonly FAST = new SpeedTier('fast');
  static readonly MEDIUM = new SpeedTier('medium');
  static readonly SLOW = new SpeedTier('slow');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a wire/stored string to a member; defaults to FAST. */
  static resolve(value: unknown): SpeedTier {
    if (value instanceof SpeedTier) return value;
    const found = SpeedTier.fromValue(String(value ?? '').trim());
    return (found as unknown as SpeedTier | undefined) ?? SpeedTier.FAST;
  }
}

import { Enum } from '@fromcode119/reactor';

/** Capability ceiling granted to a request. */
export class CapabilityTier extends Enum {
  static readonly MINIMAL = new CapabilityTier('minimal');
  static readonly LIMITED = new CapabilityTier('limited');
  static readonly HIGH = new CapabilityTier('high');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a wire/stored string to a member; defaults to MINIMAL. */
  static resolve(value: unknown): CapabilityTier {
    if (value instanceof CapabilityTier) return value;
    const found = CapabilityTier.fromValue(String(value ?? '').trim());
    return (found as unknown as CapabilityTier | undefined) ?? CapabilityTier.MINIMAL;
  }
}

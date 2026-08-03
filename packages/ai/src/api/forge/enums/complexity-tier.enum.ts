import { Enum } from '@fromcode119/reactor';

/** Estimated task complexity. */
export class ComplexityTier extends Enum {
  static readonly LOW = new ComplexityTier('low');
  static readonly MEDIUM = new ComplexityTier('medium');
  static readonly HIGH = new ComplexityTier('high');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a wire/stored string to a member; defaults to LOW. */
  static resolve(value: unknown): ComplexityTier {
    if (value instanceof ComplexityTier) return value;
    const found = ComplexityTier.fromValue(String(value ?? '').trim());
    return (found as unknown as ComplexityTier | undefined) ?? ComplexityTier.LOW;
  }
}

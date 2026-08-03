import { Enum } from '@fromcode119/reactor';

/** Requested model quality tier. */
export class ModelQuality extends Enum {
  static readonly LOCAL = new ModelQuality('local');
  static readonly STANDARD = new ModelQuality('standard');
  static readonly HIGH = new ModelQuality('high');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw string to a member; defaults to STANDARD. */
  static resolve(value: unknown): ModelQuality {
    if (value instanceof ModelQuality) return value;
    const found = ModelQuality.fromValue(String(value ?? '').trim());
    return (found as ModelQuality | undefined) ?? ModelQuality.STANDARD;
  }
}

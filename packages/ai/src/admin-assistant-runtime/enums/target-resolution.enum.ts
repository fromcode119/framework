import { Enum } from '@fromcode119/reactor';

/** Whether a homepage/content target resolved. */
export class TargetResolution extends Enum {
  static readonly RESOLVED = new TargetResolution('resolved');
  static readonly MISSING = new TargetResolution('missing');
  static readonly AMBIGUOUS = new TargetResolution('ambiguous');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw string to a member; defaults to RESOLVED. */
  static resolve(value: unknown): TargetResolution {
    if (value instanceof TargetResolution) return value;
    const found = TargetResolution.fromValue(String(value ?? '').trim());
    return (found as TargetResolution | undefined) ?? TargetResolution.RESOLVED;
  }
}

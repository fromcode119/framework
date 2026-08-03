import { Enum } from '@fromcode119/reactor';

/** Whether a reference resolved. */
export class ResolutionState extends Enum {
  static readonly RESOLVED = new ResolutionState('resolved');
  static readonly UNRESOLVED = new ResolutionState('unresolved');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw string to a member; defaults to RESOLVED. */
  static resolve(value: unknown): ResolutionState {
    if (value instanceof ResolutionState) return value;
    const found = ResolutionState.fromValue(String(value ?? '').trim());
    return (found as ResolutionState | undefined) ?? ResolutionState.RESOLVED;
  }
}

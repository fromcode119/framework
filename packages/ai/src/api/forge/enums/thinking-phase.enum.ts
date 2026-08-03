import { Enum } from '@fromcode119/reactor';

/** Phase of a streamed thinking segment. */
export class ThinkingPhase extends Enum {
  static readonly PLANNING = new ThinkingPhase('planning');
  static readonly ANALYSIS = new ThinkingPhase('analysis');
  static readonly DECISION = new ThinkingPhase('decision');
  static readonly EXECUTION = new ThinkingPhase('execution');
  static readonly VALIDATION = new ThinkingPhase('validation');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw string to a member; defaults to PLANNING. */
  static resolve(value: unknown): ThinkingPhase {
    if (value instanceof ThinkingPhase) return value;
    const found = ThinkingPhase.fromValue(String(value ?? '').trim());
    return (found as ThinkingPhase | undefined) ?? ThinkingPhase.PLANNING;
  }
}

import { Enum } from '@fromcode119/reactor';

/** Phase of a streamed thinking segment. */
export class SegmentPhase extends Enum {
  static readonly PLANNING = new SegmentPhase('planning');
  static readonly ANALYSIS = new SegmentPhase('analysis');
  static readonly DECISION = new SegmentPhase('decision');
  static readonly ACTION = new SegmentPhase('action');
  static readonly VERIFICATION = new SegmentPhase('verification');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw string to a member; defaults to PLANNING. */
  static resolve(value: unknown): SegmentPhase {
    if (value instanceof SegmentPhase) return value;
    const found = SegmentPhase.fromValue(String(value ?? '').trim());
    return (found as SegmentPhase | undefined) ?? SegmentPhase.PLANNING;
  }
}

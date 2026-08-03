import { Enum } from '@fromcode119/reactor';

/** Outcome of an error-recovery attempt. */
export class RecoveryOutcome extends Enum {
  static readonly RECOVERED = new RecoveryOutcome('recovered');
  static readonly ABANDONED = new RecoveryOutcome('abandoned');
  static readonly ESCALATED = new RecoveryOutcome('escalated');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw string to a member; defaults to RECOVERED. */
  static resolve(value: unknown): RecoveryOutcome {
    if (value instanceof RecoveryOutcome) return value;
    const found = RecoveryOutcome.fromValue(String(value ?? '').trim());
    return (found as RecoveryOutcome | undefined) ?? RecoveryOutcome.RECOVERED;
  }
}

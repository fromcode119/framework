import { Enum } from '@fromcode119/reactor';

/** Kind of security event the monitor raises. */
export class SecurityEventKind extends Enum {
  static readonly ANOMALY = new SecurityEventKind('anomaly');
  static readonly VIOLATION = new SecurityEventKind('violation');
  static readonly DENIAL_SPIKE = new SecurityEventKind('denial_spike');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw string to a member; defaults to ANOMALY. */
  static resolve(value: unknown): SecurityEventKind {
    if (value instanceof SecurityEventKind) return value;
    const found = SecurityEventKind.fromValue(String(value ?? '').trim().toLowerCase());
    return (found as SecurityEventKind | undefined) ?? SecurityEventKind.ANOMALY;
  }
}

import { Enum } from '@fromcode119/reactor';

/** Result recorded for an access-control decision in the audit log. */
export class AuditOutcome extends Enum {
  static readonly ALLOWED = new AuditOutcome('allowed');
  static readonly DENIED = new AuditOutcome('denied');
  static readonly VIOLATION = new AuditOutcome('violation');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw wire string (plugins pass strings) to a member; defaults to ALLOWED. */
  static resolve(value: unknown): AuditOutcome {
    if (value instanceof AuditOutcome) return value;
    const found = AuditOutcome.fromValue(String(value ?? '').trim().toLowerCase());
    return (found as AuditOutcome | undefined) ?? AuditOutcome.ALLOWED;
  }
}

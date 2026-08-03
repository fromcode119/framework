import { Enum } from '@fromcode119/reactor';

/** Severity of a security event. */
export class SecuritySeverity extends Enum {
  static readonly LOW = new SecuritySeverity('low');
  static readonly MEDIUM = new SecuritySeverity('medium');
  static readonly HIGH = new SecuritySeverity('high');
  static readonly CRITICAL = new SecuritySeverity('critical');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw string to a member; defaults to LOW. */
  static resolve(value: unknown): SecuritySeverity {
    if (value instanceof SecuritySeverity) return value;
    const found = SecuritySeverity.fromValue(String(value ?? '').trim().toLowerCase());
    return (found as SecuritySeverity | undefined) ?? SecuritySeverity.LOW;
  }
}

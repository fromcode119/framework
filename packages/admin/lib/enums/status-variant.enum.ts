import { Enum } from '@fromcode119/reactor';

/**
 * Display variant a status maps to — what a badge/pill renders as, independent of the status word
 * itself (`shipped` and `completed` are different statuses, both `SUCCESS`).
 *
 * An `Enum`, not a string union: a union is invisible at runtime, so nothing can resolve an arbitrary
 * status string to a variant or list the variants. `StatusService` owns the status → variant mapping.
 */
export class StatusVariant extends Enum {
  static readonly SUCCESS = new StatusVariant('success');
  static readonly WARNING = new StatusVariant('warning');
  static readonly ERROR = new StatusVariant('error');
  static readonly INFO = new StatusVariant('info');
  static readonly DEFAULT = new StatusVariant('default');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw string to a member; unknown values fall back to DEFAULT. */
  static resolve(value: unknown): StatusVariant {
    if (value instanceof StatusVariant) return value;
    const found = StatusVariant.fromValue(String(value ?? '').trim().toLowerCase());
    return (found as StatusVariant | undefined) ?? StatusVariant.DEFAULT;
  }
}

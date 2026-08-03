import { Enum } from '@fromcode119/reactor';

/** Which activity log the page shows: framework system logs or the security audit trail. */
export class ActivityMode extends Enum {
  static readonly SYSTEM = new ActivityMode('system');
  static readonly SECURITY = new ActivityMode('security');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a `?mode=` URL string to a member; defaults to SYSTEM. */
  static resolve(value: unknown): ActivityMode {
    if (value instanceof ActivityMode) return value;
    const found = ActivityMode.fromValue(String(value ?? '').trim().toLowerCase());
    return (found as ActivityMode | undefined) ?? ActivityMode.SYSTEM;
  }
}

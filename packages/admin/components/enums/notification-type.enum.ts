import { Enum } from '@fromcode119/reactor';

/** Severity of an admin toast notification (UI-only, never persisted). */
export class NotificationType extends Enum {
  static readonly SUCCESS = new NotificationType('success');
  static readonly ERROR = new NotificationType('error');
  static readonly INFO = new NotificationType('info');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw string to a member; defaults to INFO. */
  static resolve(value: unknown): NotificationType {
    if (value instanceof NotificationType) return value;
    const found = NotificationType.fromValue(String(value ?? '').trim().toLowerCase());
    return (found as NotificationType | undefined) ?? NotificationType.INFO;
  }
}

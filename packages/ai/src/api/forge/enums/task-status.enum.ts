import { Enum } from '@fromcode119/reactor';

/** Status of a planned task. */
export class TaskStatus extends Enum {
  static readonly PENDING = new TaskStatus('pending');
  static readonly IN_PROGRESS = new TaskStatus('in-progress');
  static readonly COMPLETED = new TaskStatus('completed');
  static readonly FAILED = new TaskStatus('failed');
  static readonly SKIPPED = new TaskStatus('skipped');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a wire/stored string to a member; defaults to PENDING. */
  static resolve(value: unknown): TaskStatus {
    if (value instanceof TaskStatus) return value;
    const found = TaskStatus.fromValue(String(value ?? '').trim());
    return (found as unknown as TaskStatus | undefined) ?? TaskStatus.PENDING;
  }
}

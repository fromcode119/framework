import { Enum } from '@fromcode119/reactor';

/** Progress of a planned task. */
export class TaskProgress extends Enum {
  static readonly NOT_STARTED = new TaskProgress('not-started');
  static readonly IN_PROGRESS = new TaskProgress('in-progress');
  static readonly COMPLETED = new TaskProgress('completed');
  static readonly FAILED = new TaskProgress('failed');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw string to a member; defaults to NOT_STARTED. */
  static resolve(value: unknown): TaskProgress {
    if (value instanceof TaskProgress) return value;
    const found = TaskProgress.fromValue(String(value ?? '').trim());
    return (found as TaskProgress | undefined) ?? TaskProgress.NOT_STARTED;
  }
}

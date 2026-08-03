import { Enum } from '@fromcode119/reactor';

/** Status of a plan step. */
export class PlanStepStatus extends Enum {
  static readonly PENDING = new PlanStepStatus('pending');
  static readonly RUNNING = new PlanStepStatus('running');
  static readonly COMPLETED = new PlanStepStatus('completed');
  static readonly FAILED = new PlanStepStatus('failed');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw string to a member; defaults to PENDING. */
  static resolve(value: unknown): PlanStepStatus {
    if (value instanceof PlanStepStatus) return value;
    const found = PlanStepStatus.fromValue(String(value ?? '').trim());
    return (found as PlanStepStatus | undefined) ?? PlanStepStatus.PENDING;
  }
}

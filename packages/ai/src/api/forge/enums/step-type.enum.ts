import { Enum } from '@fromcode119/reactor';

/** Kind of reasoning-chain step. */
export class StepType extends Enum {
  static readonly ANALYSIS = new StepType('analysis');
  static readonly PLANNING = new StepType('planning');
  static readonly DECISION = new StepType('decision');
  static readonly EXECUTION = new StepType('execution');
  static readonly VALIDATION = new StepType('validation');
  static readonly ERROR_RECOVERY = new StepType('error-recovery');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a wire/stored string to a member; defaults to ANALYSIS. */
  static resolve(value: unknown): StepType {
    if (value instanceof StepType) return value;
    const found = StepType.fromValue(String(value ?? '').trim());
    return (found as unknown as StepType | undefined) ?? StepType.ANALYSIS;
  }
}

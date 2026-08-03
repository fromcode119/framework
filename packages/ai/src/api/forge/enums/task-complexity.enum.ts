import { Enum } from '@fromcode119/reactor';

/** Estimated complexity of a requested task. */
export class TaskComplexity extends Enum {
  static readonly SIMPLE = new TaskComplexity('simple');
  static readonly MODERATE = new TaskComplexity('moderate');
  static readonly COMPLEX = new TaskComplexity('complex');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw string to a member; defaults to SIMPLE. */
  static resolve(value: unknown): TaskComplexity {
    if (value instanceof TaskComplexity) return value;
    const found = TaskComplexity.fromValue(String(value ?? '').trim());
    return (found as TaskComplexity | undefined) ?? TaskComplexity.SIMPLE;
  }
}

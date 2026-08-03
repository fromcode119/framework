import { Enum } from '@fromcode119/reactor';

/** Comparison used by a field visibility condition. */
export class ConditionOperator extends Enum {
  static readonly EQUALS = new ConditionOperator('equals');
  static readonly NOT_EQUALS = new ConditionOperator('notEquals');
  static readonly CONTAINS = new ConditionOperator('contains');
  static readonly NOT_CONTAINS = new ConditionOperator('notContains');
  static readonly GREATER_THAN = new ConditionOperator('greaterThan');
  static readonly LESS_THAN = new ConditionOperator('lessThan');
  static readonly EXISTS = new ConditionOperator('exists');
  static readonly NOT_EXISTS = new ConditionOperator('notExists');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw plugin/theme/wire string to a member; defaults to EQUALS. */
  static resolve(value: unknown): ConditionOperator {
    if (value instanceof ConditionOperator) return value;
    const found = ConditionOperator.fromValue(String(value ?? '').trim());
    return (found as ConditionOperator | undefined) ?? ConditionOperator.EQUALS;
  }
}

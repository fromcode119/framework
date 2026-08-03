import { Enum } from '@fromcode119/reactor';

/** Whether a recovery attempt succeeded. */
export class AttemptResult extends Enum {
  static readonly SUCCESS = new AttemptResult('success');
  static readonly FAILURE = new AttemptResult('failure');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw string to a member; defaults to SUCCESS. */
  static resolve(value: unknown): AttemptResult {
    if (value instanceof AttemptResult) return value;
    const found = AttemptResult.fromValue(String(value ?? '').trim());
    return (found as AttemptResult | undefined) ?? AttemptResult.SUCCESS;
  }
}

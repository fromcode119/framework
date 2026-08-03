import { Enum } from '@fromcode119/reactor';

/** Result kind of an executed action. */
export class ExecutionKind extends Enum {
  static readonly OK = new ExecutionKind('ok');
  static readonly SKIPPED = new ExecutionKind('skipped');
  static readonly FAILED = new ExecutionKind('failed');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw string to a member; defaults to OK. */
  static resolve(value: unknown): ExecutionKind {
    if (value instanceof ExecutionKind) return value;
    const found = ExecutionKind.fromValue(String(value ?? '').trim());
    return (found as ExecutionKind | undefined) ?? ExecutionKind.OK;
  }
}

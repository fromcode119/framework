import { Enum } from '@fromcode119/reactor';

/** Whether the reply is grounded in workspace data. */
export class AnswerGrounding extends Enum {
  static readonly GROUNDED = new AnswerGrounding('grounded');
  static readonly GENERAL = new AnswerGrounding('general');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw string to a member; defaults to GENERAL. */
  static resolve(value: unknown): AnswerGrounding {
    if (value instanceof AnswerGrounding) return value;
    const found = AnswerGrounding.fromValue(String(value ?? '').trim());
    return (found as AnswerGrounding | undefined) ?? AnswerGrounding.GENERAL;
  }
}

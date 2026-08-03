import { Enum } from '@fromcode119/reactor';

/** Which reply the message builder should produce. */
export class ReplyIntent extends Enum {
  static readonly HOMEPAGE_DRAFT = new ReplyIntent('homepage_draft');
  static readonly GENERAL = new ReplyIntent('general');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw string to a member; defaults to GENERAL. */
  static resolve(value: unknown): ReplyIntent {
    if (value instanceof ReplyIntent) return value;
    const found = ReplyIntent.fromValue(String(value ?? '').trim());
    return (found as ReplyIntent | undefined) ?? ReplyIntent.GENERAL;
  }
}

import { Enum } from '@fromcode119/reactor';

/** Whether a chunk of assistant message text is prose or a fenced code block. */
export class MessageBlockKind extends Enum {
  static readonly TEXT = new MessageBlockKind('text');
  static readonly CODE = new MessageBlockKind('code');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw string to a member; anything unrecognised is prose. */
  static resolve(value: unknown): MessageBlockKind {
    if (value instanceof MessageBlockKind) return value;
    const found = MessageBlockKind.fromValue(String(value ?? '').trim().toLowerCase());
    return (found as MessageBlockKind | undefined) ?? MessageBlockKind.TEXT;
  }
}

import { Enum } from '@fromcode119/reactor';

/** Composer chat mode toggle. */
export class ChatMode extends Enum {
  static readonly AUTO = new ChatMode('auto');
  static readonly PLAN = new ChatMode('plan');
  static readonly AGENT = new ChatMode('agent');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a wire/stored string to a member; defaults to AUTO. */
  static resolve(value: unknown): ChatMode {
    if (value instanceof ChatMode) return value;
    const found = ChatMode.fromValue(String(value ?? '').trim());
    return (found as unknown as ChatMode | undefined) ?? ChatMode.AUTO;
  }
}

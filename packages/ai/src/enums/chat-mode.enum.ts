import { Enum } from '@fromcode119/react-class-components';

/** Composer chat mode toggle. */
export class ChatMode extends Enum {
  static readonly AUTO = new ChatMode('auto');
  static readonly PLAN = new ChatMode('plan');
  static readonly AGENT = new ChatMode('agent');

  private constructor(value: string) {
    super(value);
  }

  /**
   * The member a value names, or null when it names none.
   *
   * `find`, not `resolve`: a caller reading STORED preferences has to be able to tell "the operator
   * chose auto" from "nothing was stored", and `resolve` answers AUTO to both.
   */
  static find(value: unknown): ChatMode | null {
    if (value instanceof ChatMode) return value;
    return (ChatMode.fromValue(String(value ?? '').trim()) as unknown as ChatMode | undefined) ?? null;
  }

  /** Resolve a wire/stored string to a member; defaults to AUTO. */
  static resolve(value: unknown): ChatMode {
    if (value instanceof ChatMode) return value;
    const found = ChatMode.fromValue(String(value ?? '').trim());
    return (found as unknown as ChatMode | undefined) ?? ChatMode.AUTO;
  }
}

import { Enum } from '@fromcode119/reactor';

/** The assistant's conversation mode discriminator (see also AssistantMode which carries UI metadata). */
export class ConversationMode extends Enum {
  static readonly CHAT = new ConversationMode('chat');
  static readonly BUILD = new ConversationMode('build');
  static readonly QUICKFIX = new ConversationMode('quickfix');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a wire/stored string to a member; defaults to CHAT. */
  static resolve(value: unknown): ConversationMode {
    if (value instanceof ConversationMode) return value;
    const found = ConversationMode.fromValue(String(value ?? '').trim());
    return (found as unknown as ConversationMode | undefined) ?? ConversationMode.CHAT;
  }
}

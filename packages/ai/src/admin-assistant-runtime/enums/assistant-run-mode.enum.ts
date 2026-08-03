import { Enum } from '@fromcode119/reactor';

/** How the assistant runs a turn. */
export class AssistantRunMode extends Enum {
  static readonly CHAT = new AssistantRunMode('chat');
  static readonly PLAN = new AssistantRunMode('plan');
  static readonly AGENT = new AssistantRunMode('agent');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a wire/stored string to a member; defaults to CHAT. */
  static resolve(value: unknown): AssistantRunMode {
    if (value instanceof AssistantRunMode) return value;
    const found = AssistantRunMode.fromValue(String(value ?? '').trim());
    return (found as unknown as AssistantRunMode | undefined) ?? AssistantRunMode.CHAT;
  }
}

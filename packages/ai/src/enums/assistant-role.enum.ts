import { Enum } from '@fromcode119/reactor';

/** LLM message role. Serialized verbatim as its `.value` into provider payloads. */
export class AssistantRole extends Enum {
  static readonly SYSTEM = new AssistantRole('system');
  static readonly USER = new AssistantRole('user');
  static readonly ASSISTANT = new AssistantRole('assistant');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a wire/stored string to a member; defaults to SYSTEM. */
  static resolve(value: unknown): AssistantRole {
    if (value instanceof AssistantRole) return value;
    const found = AssistantRole.fromValue(String(value ?? '').trim());
    return (found as unknown as AssistantRole | undefined) ?? AssistantRole.SYSTEM;
  }
}

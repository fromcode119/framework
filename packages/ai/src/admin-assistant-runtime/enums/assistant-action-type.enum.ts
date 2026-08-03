import { Enum } from '@fromcode119/reactor';

/** What kind of action the assistant staged. */
export class AssistantActionType extends Enum {
  static readonly CREATE_CONTENT = new AssistantActionType('create_content');
  static readonly UPDATE_SETTING = new AssistantActionType('update_setting');
  static readonly MCP_CALL = new AssistantActionType('mcp_call');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw string to a member; defaults to CREATE_CONTENT. */
  static resolve(value: unknown): AssistantActionType {
    if (value instanceof AssistantActionType) return value;
    const found = AssistantActionType.fromValue(String(value ?? '').trim());
    return (found as AssistantActionType | undefined) ?? AssistantActionType.CREATE_CONTENT;
  }
}

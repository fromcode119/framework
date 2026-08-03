import { Enum } from '@fromcode119/reactor';

/** How risky skill invocations are gated. */
export class AssistantSkillRiskPolicy extends Enum {
  static readonly READ_ONLY = new AssistantSkillRiskPolicy('read_only');
  static readonly APPROVAL_REQUIRED = new AssistantSkillRiskPolicy('approval_required');
  static readonly ALLOWLISTED_AUTO_APPLY = new AssistantSkillRiskPolicy('allowlisted_auto_apply');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a wire/stored string to a member; defaults to READ_ONLY. */
  static resolve(value: unknown): AssistantSkillRiskPolicy {
    if (value instanceof AssistantSkillRiskPolicy) return value;
    const found = AssistantSkillRiskPolicy.fromValue(String(value ?? '').trim());
    return (found as unknown as AssistantSkillRiskPolicy | undefined) ?? AssistantSkillRiskPolicy.READ_ONLY;
  }
}

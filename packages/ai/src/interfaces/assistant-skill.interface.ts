import { AssistantSkillRiskPolicy } from '@ai/admin-assistant-runtime/enums/assistant-skill-risk-policy.enum';
import { AssistantRunMode } from '@ai/admin-assistant-runtime/enums/assistant-run-mode.enum';

export interface IAssistantSkill {
  id: string;
  label: string;
  description?: string;
  defaultMode?: AssistantRunMode;
  riskPolicy?: AssistantSkillRiskPolicy;
}

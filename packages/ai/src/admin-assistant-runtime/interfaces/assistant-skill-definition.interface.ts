import type { AssistantRunMode } from '@ai/admin-assistant-runtime/enums/assistant-run-mode.enum';
import type { AssistantSkillRiskPolicy } from '@ai/admin-assistant-runtime/enums/assistant-skill-risk-policy.enum';
export interface IAssistantSkillDefinition {
  id: string;
  label: string;
  description?: string;
  defaultMode?: AssistantRunMode;
  allowedTools?: string[];
  systemPromptPatch?: string;
  riskPolicy?: AssistantSkillRiskPolicy;
  entryExamples?: string[];
}

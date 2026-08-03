import type { AssistantPlanStatus } from '@ai/admin-assistant-runtime/enums/assistant-plan-status.enum';
import { ComplexityTier } from '@ai/api/forge/enums/complexity-tier.enum';
import type { IAssistantAction } from '@ai/admin-assistant-runtime/interfaces/assistant-action.interface';
import type { IAssistantPlanStep } from '@ai/admin-assistant-runtime/interfaces/assistant-plan-step.interface';

export interface IAssistantPlanArtifact {
  id: string;
  status: AssistantPlanStatus;
  goal: string;
  summary: string;
  steps: IAssistantPlanStep[];
  actions: IAssistantAction[];
  risk: ComplexityTier;
  previewReady: boolean;
  createdAt: string;
  updatedAt: string;
}

import { PlanStepStatus } from '@ai/admin-assistant-runtime/enums/plan-step-status.enum';

export interface IAssistantPlanStep {
  id: string;
  title: string;
  status: PlanStepStatus;
  description?: string;
  toolCalls?: Array<{ tool: string; input: Record<string, any> }>;
}

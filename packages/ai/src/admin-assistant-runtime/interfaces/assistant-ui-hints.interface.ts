import type { AssistantRunMode } from '@ai/admin-assistant-runtime/enums/assistant-run-mode.enum';
import { PrimaryAction } from '@ai/enums/primary-action.enum';
import { WorkflowState } from '@ai/enums/workflow-state.enum';
import { NextStep } from '@ai/enums/next-step.enum';
import { ClarifyMode } from '@ai/api/forge/enums/clarify-mode.enum';
import { ResponseVerbosity } from '@ai/enums/response-verbosity.enum';

export interface IAssistantUiHints {
  canContinue: boolean;
  requiresApproval: boolean;
  suggestedMode: AssistantRunMode;
  showTechnicalDetailsDefault: boolean;
  nextStep?: NextStep;
  summaryMode?: ResponseVerbosity;
  workflowState?: WorkflowState;
  primaryAction?: PrimaryAction;
  userSummary?: string;
  needsClarification?: boolean;
  clarifyingQuestion?: string;
  missingInputs?: string[];
  loopRecoveryMode?: ClarifyMode;
}

import type { AssistantAction } from './types-context.types';

export type AssistantChatTrace = {
  iteration: number;
  message: string;
  phase?: 'planner' | 'executor' | 'verifier';
  toolCalls: Array<{ tool: string; input: Record<string, any> }>;
};

export type AssistantRunMode = 'chat' | 'plan' | 'agent';

export type AssistantSkillRiskPolicy = 'read_only' | 'approval_required' | 'allowlisted_auto_apply';

export type AssistantSkillDefinition = {
  id: string;
  label: string;
  description?: string;
  defaultMode?: AssistantRunMode;
  allowedTools?: string[];
  systemPromptPatch?: string;
  riskPolicy?: AssistantSkillRiskPolicy;
  entryExamples?: string[];
};

export type AssistantPlanStatus =
  | 'draft'
  | 'searching'
  | 'staged'
  | 'paused'
  | 'ready_for_preview'
  | 'ready_for_apply'
  | 'completed'
  | 'failed';

export type AssistantPlanStep = {
  id: string;
  title: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  description?: string;
  toolCalls?: Array<{ tool: string; input: Record<string, any> }>;
};

export type AssistantPlanArtifact = {
  id: string;
  status: AssistantPlanStatus;
  goal: string;
  summary: string;
  steps: AssistantPlanStep[];
  actions: AssistantAction[];
  risk: 'low' | 'medium' | 'high';
  previewReady: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AssistantUiHints = {
  canContinue: boolean;
  requiresApproval: boolean;
  suggestedMode: AssistantRunMode;
  showTechnicalDetailsDefault: boolean;
  nextStep?: 'reply' | 'preview' | 'apply' | 'none';
  summaryMode?: 'concise' | 'detailed';
  workflowState?: 'reply' | 'clarify' | 'staged' | 'previewed' | 'applied' | 'stale';
  primaryAction?: 'none' | 'send' | 'preview' | 'apply';
  userSummary?: string;
  needsClarification?: boolean;
  clarifyingQuestion?: string;
  missingInputs?: string[];
  loopRecoveryMode?: 'none' | 'clarify' | 'best_effort';
};

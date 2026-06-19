import type { AssistantAction } from './types-context.types';
import type { AssistantChatTrace, AssistantPlanArtifact, AssistantUiHints, AssistantSkillDefinition } from './types-plan.types';
import type { AssistantActionBatch, AssistantSessionCheckpoint } from './types-session.types';

export type AssistantChatResult = {
  message: string;
  actions: AssistantAction[];
  model: string;
  agentMode: 'basic' | 'advanced';
  done: boolean;
  traces: AssistantChatTrace[];
  plan?: AssistantPlanArtifact;
  ui?: AssistantUiHints;
  actionBatch?: AssistantActionBatch;
  skill?: AssistantSkillDefinition;
  sessionId?: string;
  checkpoint?: AssistantSessionCheckpoint;
  iterations?: number;
  loopCapReached?: boolean;
};

export type ProviderCapabilities = {
  supportsJsonMode: boolean;
  supportsToolCallSchema: boolean;
  maxContextTokens: number;
  qualityTier: 'local' | 'standard' | 'high';
};

export type AssistantExecuteResult = {
  success: boolean;
  dryRun: boolean;
  results: any[];
  executedBatchId?: string;
  batchState?: 'previewed' | 'applied';
  executionSummary?: { ok: number; unchanged: number; failed: number };
};

export type AssistantChatInput = {
  message: string;
  provider?: string;
  history?: Array<{ role?: string; content?: string }>;
  agentMode?: string;
  maxIterations?: number;
  maxDurationMs?: number;
  allowedTools?: string[];
  skillId?: string;
  sessionId?: string;
  continueFrom?: boolean;
  checkpoint?: AssistantSessionCheckpoint;
};

export type AssistantExecuteInput = {
  actions: any[];
  dryRun?: boolean;
  context?: Record<string, any>;
};

export type AssistantSettingValue = {
  found: boolean;
  value: any;
  group?: string | null;
};

export type AssistantPromptProfile = {
  basicSystem?: string;
  advancedSystem?: string;
};

export type AssistantPromptCopy = {
  basic?: string[];
  advanced?: string[];
};

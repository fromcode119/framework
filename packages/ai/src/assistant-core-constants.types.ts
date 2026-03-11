// ─── Companion types file for assistant-core-constants.ts ───────────────────
// This file contains all exported types and interfaces from assistant-core-constants.ts
// Classes and runtime values remain in the original file.

export type AssistantAction = {
  type: string;
  collectionSlug?: string;
  data?: Record<string, any>;
  key?: string;
  value?: string;
  reason?: string;
  tool?: string;
  input?: Record<string, any>;
};

export type AssistantMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: UploadedAttachment[];
  actions?: AssistantAction[];
  actionBatch?: AssistantActionBatch;
  traces?: AssistantTrace[];
  plan?: AssistantPlanArtifact;
  ui?: AssistantUiHints;
  skill?: AssistantSkill;
  sessionId?: string;
  checkpoint?: AssistantCheckpoint;
  done?: boolean;
  iterations?: number;
  loopCapReached?: boolean;
  model?: string;
  provider?: string;
  reasoningReport?: string;
  execution?: any;
};

export type AssistantPlanArtifact = {
  id: string;
  status:
    | 'draft'
    | 'searching'
    | 'staged'
    | 'paused'
    | 'ready_for_preview'
    | 'ready_for_apply'
    | 'completed'
    | 'failed';
  goal: string;
  summary: string;
  risk: 'low' | 'medium' | 'high';
  previewReady: boolean;
};

export type AssistantUiHints = {
  canContinue: boolean;
  requiresApproval: boolean;
  suggestedMode: 'chat' | 'plan' | 'agent';
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

export type AssistantSkill = {
  id: string;
  label: string;
  description?: string;
  defaultMode?: 'chat' | 'plan' | 'agent';
  riskPolicy?: 'read_only' | 'approval_required' | 'allowlisted_auto_apply';
};

export type AssistantCheckpoint = {
  resumePrompt?: string;
  reason?: 'loop_cap' | 'time_cap' | 'user_continue' | 'clarification_needed' | 'loop_recovery';
  stage?: 'classify' | 'retrieve' | 'plan' | 'clarify' | 'finalize';
  planningPassesUsed?: number;
  memory?: {
    listing?: {
      collectionSlug: string;
      lastSelectedRowIndex?: number;
      lastSelectedRecordId?: string;
      lastSelectedField?: string;
    };
  };
};

export type AssistantActionBatch = {
  id: string;
  state: 'staged' | 'previewed' | 'applied' | 'stale';
  createdAt: number;
};

export type AssistantToolOption = {
  tool: string;
  description?: string;
  readOnly?: boolean;
};

export type AssistantTrace = {
  iteration: number;
  message?: string;
  toolCalls?: Array<{ tool?: string; input?: Record<string, any> }>;
};

export type UploadedAttachment = {
  id?: string;
  name: string;
  url?: string;
  path?: string;
  mimeType?: string;
  size?: number;
  width?: number;
  height?: number;
};

export type MessageBlock =
  | { type: 'text'; content: string }
  | { type: 'code'; content: string; language: string };

export type ForgeHistorySession = {
  id: string;
  title: string;
  updatedAt: number;
  provider: string;
  model: string;
  skillId?: string;
  chatMode: 'auto' | 'plan' | 'agent';
  sandboxMode: boolean;
  messages: AssistantMessage[];
  messageCount?: number;
};

export type ConversationMode = 'chat' | 'build' | 'quickfix';
export type AssistantViewport = 'desktop' | 'mobile';
export type SidebarOverlay = 'none' | 'left' | 'right';
export type AssistantLayoutState = {
  viewport: AssistantViewport;
  leftOpen: boolean;
  rightOpen: boolean;
  overlay: SidebarOverlay;
};
export type PlanCardSummary = {
  goal: string;
  found: string;
  propose: string;
  approval: string;
};

export type ExecutionCardSummary = {
  changed: string;
  where: string;
  status: string;
};
export type HumanActionPreview = {
  title: string;
  target: string;
  summary: string;
  fieldPreviews: Array<{ field: string; value: string }>;
};

export type ActionSurface = 'frontend' | 'backend' | 'mixed';

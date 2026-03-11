import type { McpToolDefinition } from '@fromcode119/mcp';
import type { AssistantClient } from '../types.interfaces';

export type AssistantCollectionContext = {
  slug: string;
  shortSlug: string;
  label: string;
  pluginSlug: string;
  raw?: any;
};

export type AssistantPluginContext = {
  slug: string;
  name: string;
  version: string;
  state: string;
  capabilities?: string[];
  path?: string;
};

export type AssistantThemeContext = {
  slug: string;
  name: string;
  version: string;
  state: string;
  path?: string;
};

export type AssistantAction = {
  type: 'create_content' | 'update_setting' | 'mcp_call';
  collectionSlug?: string;
  data?: Record<string, any>;
  key?: string;
  value?: string;
  reason?: string;
  tool?: string;
  input?: Record<string, any>;
};

export type AssistantToolSummary = Pick<McpToolDefinition, 'tool' | 'description' | 'readOnly'>;

export type AssistantWorkspaceMapPlugin = {
  slug: string;
  name: string;
  version?: string;
  state?: string;
  capabilities?: string[];
  path?: string;
};

export type AssistantWorkspaceMapTheme = {
  slug: string;
  name: string;
  version?: string;
  state?: string;
  path?: string;
};

export type AssistantWorkspaceMapCollection = {
  slug: string;
  shortSlug: string;
  label: string;
  pluginSlug: string;
  fieldNames?: string[];
};

export type AssistantWorkspaceMapTool = {
  tool: string;
  readOnly: boolean;
};

export type AssistantWorkspaceMap = {
  generatedAt: number;
  frameworkRoot?: string;
  activeThemeSlug?: string;
  plugins: AssistantWorkspaceMapPlugin[];
  themes: AssistantWorkspaceMapTheme[];
  collections: AssistantWorkspaceMapCollection[];
  tools: AssistantWorkspaceMapTool[];
};

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

export type AssistantSessionEntityMemory = {
  listing?: {
    collectionSlug: string;
    lastSelectedRowIndex?: number;
    lastSelectedRecordId?: string;
    lastSelectedField?: string;
  };
};

export type AssistantSessionCheckpoint = {
  resumePrompt: string;
  reason: 'loop_cap' | 'time_cap' | 'user_continue' | 'clarification_needed' | 'loop_recovery';
  stage?: 'classify' | 'retrieve' | 'plan' | 'clarify' | 'finalize';
  planningPassesUsed?: number;
  memory?: AssistantSessionEntityMemory;
};

export type AssistantActionBatch = {
  id: string;
  state: 'staged' | 'previewed' | 'applied' | 'stale';
  createdAt: number;
};

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

export type AdminAssistantRuntimeOptions = {
  aiClient?: AssistantClient | null;
  getCollections: () => AssistantCollectionContext[];
  getPlugins?: () => AssistantPluginContext[];
  getThemes?: () => AssistantThemeContext[];
  findCollectionBySlug: (source: string) => AssistantCollectionContext | null | undefined;
  listContent?: (
    collection: AssistantCollectionContext,
    options: { limit?: number; offset?: number; context?: Record<string, any> }
  ) => Promise<{ docs: any[]; totalDocs?: number; limit?: number; offset?: number }>;
  resolveContent?: (
    collection: AssistantCollectionContext,
    selector: {
      id?: string | number;
      slug?: string;
      permalink?: string;
      where?: Record<string, any>;
    },
    context: Record<string, any>
  ) => Promise<any | null>;
  createContent: (
    collection: AssistantCollectionContext,
    payload: Record<string, any>,
    context: Record<string, any>
  ) => Promise<any>;
  updateContent?: (
    collection: AssistantCollectionContext,
    targetId: string | number,
    payload: Record<string, any>,
    context: Record<string, any>
  ) => Promise<any>;
  getSetting: (key: string) => Promise<AssistantSettingValue>;
  upsertSetting: (key: string, value: string, group: string) => Promise<void>;
  resolveAdditionalTools?: (context: { dryRun: boolean }) => Promise<McpToolDefinition[]> | McpToolDefinition[];
  resolveAdditionalPromptLines?: (context: {
    collections: AssistantCollectionContext[];
    tools: AssistantToolSummary[];
  }) => Promise<string[]> | string[];
  resolveWorkspaceMap?: (context: {
    collections: AssistantCollectionContext[];
    plugins: AssistantPluginContext[];
    themes: AssistantThemeContext[];
    tools: AssistantToolSummary[];
  }) => Promise<AssistantWorkspaceMap> | AssistantWorkspaceMap;
  resolvePromptProfile?: (context: {
    collections: AssistantCollectionContext[];
    plugins: AssistantPluginContext[];
    tools: AssistantToolSummary[];
  }) => Promise<AssistantPromptProfile> | AssistantPromptProfile;
  resolvePromptCopy?: (context: {
    collections: AssistantCollectionContext[];
    plugins: AssistantPluginContext[];
    tools: AssistantToolSummary[];
  }) => Promise<AssistantPromptCopy> | AssistantPromptCopy;
  resolveSkills?: () => Promise<AssistantSkillDefinition[]> | AssistantSkillDefinition[];
  now?: () => string;
};

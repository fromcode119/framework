// ─── Companion types file for runtime/types.ts ──────────────────────────────
import type {
  AssistantAction,
  AssistantChatInput,
  AssistantCollectionContext,
  AssistantSessionCheckpoint,
  AssistantSkillDefinition,
  AssistantToolSummary,
  AdminAssistantRuntimeOptions,
  ProviderCapabilities,
  AssistantWorkspaceMap,
} from '../types';
import type { McpBridge } from '@fromcode119/mcp';

export type RuntimeStage = 'classify' | 'retrieve' | 'plan' | 'clarify' | 'finalize';

export type RuntimeIntentKind =
  | 'smalltalk'
  | 'factual_qa'
  | 'homepage_draft'
  | 'replace_text'
  | 'action_request'
  | 'chat'
  | 'unknown';

export type RuntimeIntent = {
  kind: RuntimeIntentKind;
  confidence: number;
  replace?: { from: string; to: string };
  urlHint?: string;
  queryHint?: string;
  quickAnswer?: string;
};

export type RuntimeToolCall = {
  tool: string;
  input: Record<string, any>;
};

export type RuntimeToolResult = {
  tool: string;
  input: Record<string, any>;
  ok: boolean;
  output?: any;
  error?: string;
};

export type RuntimeRetrievalResult = {
  stage: RuntimeStage;
  confidence: number;
  queryHints: string[];
  passes: number;
  calls: RuntimeToolCall[];
  results: RuntimeToolResult[];
  blockedTools: string[];
  availableToolNames: Set<string>;
};

export type RuntimePlanResult = {
  stage: RuntimeStage;
  message: string;
  actions: AssistantAction[];
  needsClarification?: boolean;
  clarifyingQuestion?: string;
  missingInputs?: string[];
  checkpoint?: AssistantSessionCheckpoint;
  loopRecoveryMode?: 'none' | 'clarify' | 'best_effort';
};

export type RuntimeContext = {
  input: AssistantChatInput;
  options: AdminAssistantRuntimeOptions;
  now: number;
  collections: AssistantCollectionContext[];
  selectedSkill?: AssistantSkillDefinition;
  tools: AssistantToolSummary[];
  bridge: McpBridge;
  allowedToolSet: Set<string>;
  checkpoint?: AssistantSessionCheckpoint;
  history: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  workspaceMap: AssistantWorkspaceMap;
};

export type RuntimeDependencies = {
  options: AdminAssistantRuntimeOptions;
  resolveSkills: () => Promise<AssistantSkillDefinition[]>;
  createBridge: (dryRun: boolean) => Promise<McpBridge>;
  listTools: (dryRun: boolean) => Promise<AssistantToolSummary[]>;
  sanitizeMessage: (message: string) => string;
  toRunMode: (value: string) => 'chat' | 'plan' | 'agent';
  buildPlanArtifact: (input: {
    planId: string;
    goal: string;
    message: string;
    actions: AssistantAction[];
    traces: Array<{ iteration: number; message: string; phase?: 'planner' | 'executor' | 'verifier'; toolCalls: Array<{ tool: string; input: Record<string, any> }> }>;
    loopCapReached: boolean;
    loopTimeLimitReached: boolean;
    done: boolean;
    selectedSkill?: AssistantSkillDefinition;
  }) => any;
  buildUiHints: (input: {
    hasActions: boolean;
    loopCapReached: boolean;
    loopTimeLimitReached: boolean;
    done: boolean;
    selectedSkill?: AssistantSkillDefinition;
    planningPassesUsed?: number;
    needsClarification?: boolean;
    clarifyingQuestion?: string;
    missingInputs?: string[];
    loopRecoveryMode?: 'none' | 'clarify' | 'best_effort';
  }) => any;
  resolveAgentMode: (input: AssistantChatInput, selectedSkill?: AssistantSkillDefinition) => 'basic' | 'advanced';
  resolveSkillForInput: (input: AssistantChatInput, skills: AssistantSkillDefinition[]) => AssistantSkillDefinition | undefined;
  resolveProviderCapabilities: (provider: string) => ProviderCapabilities;
};
